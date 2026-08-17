using System.Security.Claims;
using ChatApp.Core.DTOs;
using ChatApp.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class UserController : ControllerBase
{
    private readonly ChatDbContext _context;

    public UserController(ChatDbContext context)
    {
        _context = context;
    }

    [HttpGet("search")]
    public async Task<ActionResult<IEnumerable<UserDto>>> SearchUsers([FromQuery] string query)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var currentUserId))
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(query))
        {
            return Ok(new List<UserDto>());
        }

        var users = await _context.Users
            .Where(u => u.Id != currentUserId && 
                        (u.Username.Contains(query) || u.Email.Contains(query)))
            .Select(u => new UserDto
            {
                Id = u.Id,
                Username = u.Username,
                Email = u.Email,
                IsOnline = u.IsOnline,
                LastSeen = u.LastSeen
            })
            .Take(10)
            .ToListAsync();

        return Ok(users);
    }

    [HttpGet("online")]
    public async Task<ActionResult<IEnumerable<UserDto>>> GetOnlineUsers()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var currentUserId))
        {
            return Unauthorized();
        }

        var users = await _context.Users
            .Where(u => u.Id != currentUserId && u.IsOnline)
            .Select(u => new UserDto
            {
                Id = u.Id,
                Username = u.Username,
                Email = u.Email,
                IsOnline = u.IsOnline,
                LastSeen = u.LastSeen
            })
            .ToListAsync();

        return Ok(users);
    }
}
