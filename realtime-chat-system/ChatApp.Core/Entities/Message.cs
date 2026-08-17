namespace ChatApp.Core.Entities;

public class Message
{
    public int Id { get; set; }

    public int ChatId { get; set; }

    public Chat Chat { get; set; } = null!;

    public int SenderId { get; set; }

    public User Sender { get; set; } = null!;

    public string Content { get; set; } = string.Empty;

    public DateTime SentAt { get; set; } = DateTime.UtcNow;

    public DateTime? DeliveredAt { get; set; }

    public DateTime? ReadAt { get; set; }

    public string MessageType { get; set; } = "Text";
}