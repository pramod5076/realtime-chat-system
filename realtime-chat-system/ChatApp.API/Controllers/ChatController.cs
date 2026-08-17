using System.Security.Claims;
using ChatApp.Core.DTOs;
using ChatApp.Core.Entities;
using ChatApp.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ChatController : ControllerBase
{
    private readonly ChatDbContext _context;

    public ChatController(ChatDbContext context)
    {
        _context = context;
    }

    [HttpPost("private")]
    public async Task<ActionResult<ChatDto>> CreatePrivateChat(CreatePrivateChatDto dto)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var currentUserId))
        {
            return Unauthorized();
        }

        if (currentUserId == dto.TargetUserId)
        {
            return BadRequest("You cannot start a private chat with yourself.");
        }

        // Verify target user exists
        var targetUser = await _context.Users.FindAsync(dto.TargetUserId);
        if (targetUser == null)
        {
            return NotFound("Target user not found.");
        }

        // Check if private chat already exists
        var existingChat = await _context.Chats
            .Include(c => c.Members)
            .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(c => c.ChatType == "Private" &&
                                      c.Members.Any(m => m.UserId == currentUserId) &&
                                      c.Members.Any(m => m.UserId == dto.TargetUserId));

        if (existingChat != null)
        {
            return Ok(MapToChatDto(existingChat, currentUserId));
        }

        // Create new private chat
        var chat = new Chat
        {
            ChatType = "Private",
            CreatedAt = DateTime.UtcNow
        };

        chat.Members.Add(new ChatMember { UserId = currentUserId });
        chat.Members.Add(new ChatMember { UserId = dto.TargetUserId });

        _context.Chats.Add(chat);
        await _context.SaveChangesAsync();

        // Reload to get complete user data
        var reloadedChat = await _context.Chats
            .Include(c => c.Members)
            .ThenInclude(m => m.User)
            .FirstAsync(c => c.Id == chat.Id);

        return Ok(MapToChatDto(reloadedChat, currentUserId));
    }

    [HttpPost("group")]
    public async Task<ActionResult<ChatDto>> CreateGroupChat(CreateGroupChatDto dto)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var currentUserId))
        {
            return Unauthorized();
        }

        var chat = new Chat
        {
            ChatType = "Group",
            ChatName = dto.ChatName,
            CreatedAt = DateTime.UtcNow
        };

        // Add creator
        chat.Members.Add(new ChatMember { UserId = currentUserId });

        // Add other members (filtering out duplicates or invalid IDs)
        var memberIds = dto.MemberIds.Distinct().Where(id => id != currentUserId);
        foreach (var id in memberIds)
        {
            var userExists = await _context.Users.AnyAsync(u => u.Id == id);
            if (userExists)
            {
                chat.Members.Add(new ChatMember { UserId = id });
            }
        }

        _context.Chats.Add(chat);
        await _context.SaveChangesAsync();

        // Reload to get full details
        var reloadedChat = await _context.Chats
            .Include(c => c.Members)
            .ThenInclude(m => m.User)
            .FirstAsync(c => c.Id == chat.Id);

        return Ok(MapToChatDto(reloadedChat, currentUserId));
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ChatDto>>> GetChats()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var currentUserId))
        {
            return Unauthorized();
        }

        var chats = await _context.Chats
            .Include(c => c.Members)
            .ThenInclude(m => m.User)
            .Include(c => c.Messages)
            .ThenInclude(m => m.Sender)
            .Where(c => c.Members.Any(m => m.UserId == currentUserId))
            .OrderByDescending(c => c.Messages.Max(m => (DateTime?)m.SentAt) ?? c.CreatedAt)
            .ToListAsync();

        var chatDtos = chats.Select(c => MapToChatDto(c, currentUserId)).ToList();
        return Ok(chatDtos);
    }

    [HttpGet("{chatId}/messages")]
    public async Task<ActionResult<IEnumerable<MessageDto>>> GetMessages(int chatId)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var currentUserId))
        {
            return Unauthorized();
        }

        // Check if user is member of chat
        var isMember = await _context.ChatMembers.AnyAsync(cm => cm.ChatId == chatId && cm.UserId == currentUserId);
        if (!isMember)
        {
            return Forbid();
        }

        var messages = await _context.Messages
            .Include(m => m.Sender)
            .Where(m => m.ChatId == chatId)
            .OrderBy(m => m.SentAt)
            .Select(m => new MessageDto
            {
                Id = m.Id,
                ChatId = m.ChatId,
                SenderId = m.SenderId,
                SenderUsername = m.Sender.Username,
                Content = m.Content,
                SentAt = m.SentAt,
                MessageType = m.MessageType
            })
            .ToListAsync();

        return Ok(messages);
    }

    private static ChatDto MapToChatDto(Chat chat, int currentUserId)
    {
        var lastMessage = chat.Messages
            .OrderByDescending(m => m.SentAt)
            .FirstOrDefault();

        string? chatName = chat.ChatName;

        // For private chats, the name displayed should be the username of the OTHER member
        if (chat.ChatType == "Private")
        {
            var otherMember = chat.Members.FirstOrDefault(m => m.UserId != currentUserId);
            chatName = otherMember?.User.Username ?? "Deleted User";
        }

        return new ChatDto
        {
            Id = chat.Id,
            ChatType = chat.ChatType,
            ChatName = chatName,
            CreatedAt = chat.CreatedAt,
            Members = chat.Members.Select(m => new UserDto
            {
                Id = m.UserId,
                Username = m.User.Username,
                Email = m.User.Email,
                IsOnline = m.User.IsOnline,
                LastSeen = m.User.LastSeen
            }).ToList(),
            LastMessage = lastMessage != null ? new MessageDto
            {
                Id = lastMessage.Id,
                ChatId = lastMessage.ChatId,
                SenderId = lastMessage.SenderId,
                SenderUsername = lastMessage.Sender.Username,
                Content = lastMessage.Content,
                SentAt = lastMessage.SentAt,
                MessageType = lastMessage.MessageType
            } : null
        };
    }
}
