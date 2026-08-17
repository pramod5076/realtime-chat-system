using System.ComponentModel.DataAnnotations;

namespace ChatApp.Core.DTOs;

public class ChatDto
{
    public int Id { get; set; }
    public string ChatType { get; set; } = "Private";
    public string? ChatName { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<UserDto> Members { get; set; } = new();
    public MessageDto? LastMessage { get; set; }
}

public class CreatePrivateChatDto
{
    [Required]
    public int TargetUserId { get; set; }
}

public class CreateGroupChatDto
{
    [Required]
    [StringLength(100, MinimumLength = 3)]
    public string ChatName { get; set; } = string.Empty;

    [Required]
    [MinLength(1)]
    public List<int> MemberIds { get; set; } = new();
}
