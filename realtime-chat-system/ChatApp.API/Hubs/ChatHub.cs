using System.Security.Claims;
using ChatApp.Core.DTOs;
using ChatApp.Core.Entities;
using ChatApp.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.API.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private readonly ChatDbContext _context;
    private static readonly Dictionary<int, HashSet<string>> UserConnections = new();

    public ChatHub(ChatDbContext context)
    {
        _context = context;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = GetUserId();
        if (userId > 0)
        {
            lock (UserConnections)
            {
                if (!UserConnections.ContainsKey(userId))
                {
                    UserConnections[userId] = new HashSet<string>();
                }
                UserConnections[userId].Add(Context.ConnectionId);
            }

            // Mark user as online in DB if this is their first connection
            var user = await _context.Users.FindAsync(userId);
            if (user != null && !user.IsOnline)
            {
                user.IsOnline = true;
                user.LastSeen = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                // Notify all clients that this user is online
                await Clients.All.SendAsync("UserPresence", new { UserId = userId, IsOnline = true });
            }

            // Automatically join the user to all their chats' SignalR groups
            var chatIds = await _context.ChatMembers
                .Where(cm => cm.UserId == userId)
                .Select(cm => cm.ChatId)
                .ToListAsync();

            foreach (var chatId in chatIds)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"chat_{chatId}");
            }
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetUserId();
        if (userId > 0)
        {
            bool isOffline = false;
            lock (UserConnections)
            {
                if (UserConnections.ContainsKey(userId))
                {
                    UserConnections[userId].Remove(Context.ConnectionId);
                    if (UserConnections[userId].Count == 0)
                    {
                        UserConnections.Remove(userId);
                        isOffline = true;
                    }
                }
            }

            if (isOffline)
            {
                // Mark user as offline in DB
                var user = await _context.Users.FindAsync(userId);
                if (user != null)
                {
                    user.IsOnline = false;
                    user.LastSeen = DateTime.UtcNow;
                    await _context.SaveChangesAsync();

                    // Notify all clients that this user is offline
                    await Clients.All.SendAsync("UserPresence", new { UserId = userId, IsOnline = false, LastSeen = user.LastSeen });
                }
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task SendMessage(int chatId, string content)
    {
        var userId = GetUserId();
        if (userId <= 0)
        {
            throw new HubException("Unauthorized.");
        }

        // Verify user is in chat
        var member = await _context.ChatMembers
            .Include(cm => cm.User)
            .FirstOrDefaultAsync(cm => cm.ChatId == chatId && cm.UserId == userId);

        if (member == null)
        {
            throw new HubException("You are not a member of this chat.");
        }

        var message = new Message
        {
            ChatId = chatId,
            SenderId = userId,
            Content = content,
            SentAt = DateTime.UtcNow,
            MessageType = "Text"
        };

        _context.Messages.Add(message);
        await _context.SaveChangesAsync();

        var messageDto = new MessageDto
        {
            Id = message.Id,
            ChatId = message.ChatId,
            SenderId = message.SenderId,
            SenderUsername = member.User.Username,
            Content = message.Content,
            SentAt = message.SentAt,
            MessageType = message.MessageType
        };

        // Broadcast to group
        await Clients.Group($"chat_{chatId}").SendAsync("ReceiveMessage", messageDto);
    }

    public async Task JoinChatGroup(int chatId)
    {
        var userId = GetUserId();
        if (userId <= 0) return;

        // Verify user is member of chat
        var isMember = await _context.ChatMembers.AnyAsync(cm => cm.ChatId == chatId && cm.UserId == userId);
        if (isMember)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"chat_{chatId}");
        }
    }

    public async Task LeaveChatGroup(int chatId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"chat_{chatId}");
    }

    private int GetUserId()
    {
        var claim = Context.User?.FindFirst(ClaimTypes.NameIdentifier);
        if (claim != null && int.TryParse(claim.Value, out var userId))
        {
            return userId;
        }
        return 0;
    }
}