using System.Security.Claims;
using ChatApp.API.Services;
using ChatApp.Core.DTOs;
using ChatApp.Core.Entities;
using ChatApp.Core.Helpers;
using ChatApp.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly ChatDbContext _context;
    private readonly TokenService _tokenService;

    public AuthController(ChatDbContext context, TokenService tokenService)
    {
        _context = context;
        _tokenService = tokenService;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponseDto>> Register(RegisterDto dto)
    {
        if (await _context.Users.AnyAsync(u => u.Email.ToLower() == dto.Email.ToLower()))
        {
            return BadRequest("Email is already registered.");
        }

        if (await _context.Users.AnyAsync(u => u.Username.ToLower() == dto.Username.ToLower()))
        {
            return BadRequest("Username is already taken.");
        }

        var user = new User
        {
            Username = dto.Username,
            Email = dto.Email,
            PasswordHash = PasswordHasher.HashPassword(dto.Password),
            Role = "User",
            IsOnline = false,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var token = _tokenService.GenerateToken(user);

        return Ok(new AuthResponseDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            Token = token,
            Role = user.Role
        });
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login(LoginDto dto)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == dto.Email.ToLower());
        if (user == null)
        {
            return Unauthorized("Invalid email or password.");
        }

        if (!PasswordHasher.VerifyPassword(dto.Password, user.PasswordHash))
        {
            return Unauthorized("Invalid email or password.");
        }

        var token = _tokenService.GenerateToken(user);

        return Ok(new AuthResponseDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            Token = token,
            Role = user.Role
        });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> GetMe()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return NotFound("User not found.");
        }

        return Ok(new UserDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            IsOnline = user.IsOnline,
            LastSeen = user.LastSeen
        });
    }
}
