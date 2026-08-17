namespace ChatApp.Core.Entities;

public class User
{
    public int Id { get; set; }

    public string Username { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public string Role { get; set; } = "User";

    public bool IsOnline { get; set; }

    public DateTime? LastSeen { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ChatMember> ChatMembers { get; set; }
        = new List<ChatMember>();

    public ICollection<Message> SentMessages { get; set; }
        = new List<Message>();
}