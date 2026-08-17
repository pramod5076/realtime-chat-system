using ChatApp.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Infrastructure.Data;

public class ChatDbContext : DbContext
{
    public ChatDbContext(
        DbContextOptions<ChatDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();

    public DbSet<Chat> Chats => Set<Chat>();

    public DbSet<ChatMember> ChatMembers => Set<ChatMember>();

    public DbSet<Message> Messages => Set<Message>();

    protected override void OnModelCreating(
        ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username)
            .IsUnique();

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<ChatMember>()
            .HasKey(cm => new
            {
                cm.ChatId,
                cm.UserId
            });

        modelBuilder.Entity<ChatMember>()
            .HasOne(cm => cm.Chat)
            .WithMany(c => c.Members)
            .HasForeignKey(cm => cm.ChatId);

        modelBuilder.Entity<ChatMember>()
            .HasOne(cm => cm.User)
            .WithMany(u => u.ChatMembers)
            .HasForeignKey(cm => cm.UserId);

        modelBuilder.Entity<Message>()
            .HasOne(m => m.Chat)
            .WithMany(c => c.Messages)
            .HasForeignKey(m => m.ChatId);

        modelBuilder.Entity<Message>()
            .HasOne(m => m.Sender)
            .WithMany(u => u.SentMessages)
            .HasForeignKey(m => m.SenderId);
    }
}