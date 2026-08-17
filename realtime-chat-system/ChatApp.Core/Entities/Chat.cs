namespace ChatApp.Core.Entities;

public class Chat
{
    public int Id { get; set; }

    public string ChatType { get; set; } = "Private";

    public string? ChatName { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ChatMember> Members { get; set; }
        = new List<ChatMember>();

    public ICollection<Message> Messages { get; set; }
        = new List<Message>();
}