namespace ChatApp.Core.DTOs;

public class MessageDto
{
    public int Id { get; set; }
    public int ChatId { get; set; }
    public int SenderId { get; set; }
    public string SenderUsername { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime SentAt { get; set; }
    public string MessageType { get; set; } = "Text";
}
