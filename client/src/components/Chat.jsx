import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import socket from '../socket';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, LogOut, MessageSquare, ShieldCheck, Globe, Hash } from 'lucide-react';
import { encryptMessage, decryptMessage } from '../utils/encryption';

const Chat = () => {
    const { user, logout } = useContext(AuthContext);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [room, setRoom] = useState('global');
    const [rooms, setRooms] = useState(['global', 'development', 'design', 'random']);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [unreadCounts, setUnreadCounts] = useState({});

    useEffect(() => {
        if (user) {
            socket.emit('set_user', user._id);
        }

        socket.emit('join_room', room);

        socket.on('receive_message', (data) => {
            const decryptedData = { ...data, message: decryptMessage(data.message) };
            
            // Check if message is for the current room
            if (data.room === room) {
                setMessages((prev) => [...prev, decryptedData]);
            } else {
                // Background notification
                setUnreadCounts((prev) => ({
                    ...prev,
                    [data.room]: (prev[data.room] || 0) + 1
                }));
            }
        });

        socket.on('online_users', (users) => {
            setOnlineUsers(users);
        });

        socket.on('message_history', (history) => {
            const decryptedHistory = history.map(msg => ({
                ...msg,
                message: decryptMessage(msg.message)
            }));
            setMessages(decryptedHistory);
        });

        return () => {
            socket.off('receive_message');
            socket.off('online_users');
            socket.off('message_history');
        };
    }, [room, user]);

    const sendMessage = () => {
        if (message !== '') {
            const encryptedContent = encryptMessage(message);
            const messageData = {
                room: room,
                author: user.username,
                userId: user._id,
                message: encryptedContent,
                time: new Date().toLocaleTimeString(),
            };
            socket.emit('send_message', messageData);
            setMessages((prev) => [...prev, { ...messageData, message: message }]);
            setMessage('');
        }
    };

    return (
        <div className="flex h-screen bg-slate-900 text-white overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col p-4">
                <div className="flex items-center gap-2 mb-8">
                    <MessageSquare className="text-primary" />
                    <h1 className="text-xl font-bold tracking-tight">ChatEngine</h1>
                </div>
                <div className="flex-1 space-y-1 overflow-y-auto pr-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Channels</p>
                    {rooms.map((r) => (
                        <div 
                            key={r}
                            onClick={() => { 
                                if (room !== r) {
                                    setRoom(r); 
                                    setMessages([]);
                                    setUnreadCounts((prev) => ({ ...prev, [r]: 0 }));
                                }
                            }}
                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                                room === r 
                                ? 'bg-primary bg-opacity-20 text-primary font-semibold' 
                                : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                            }`}
                        >
                            <Hash size={16} />
                            <span className="text-sm flex-1">{r}</span>
                            {unreadCounts[r] > 0 && (
                                <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                    {unreadCounts[r]}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
                <div className="mt-4 p-3 bg-slate-700 bg-opacity-30 rounded-xl border border-slate-700">
                    <div className="flex items-center gap-2 text-[10px] text-green-400 font-bold uppercase mb-1">
                        <ShieldCheck size={12} />
                        <span>E2EE Active</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">Messages are encrypted client-side.</p>
                </div>
                <div className="mt-auto pt-4 border-t border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold uppercase text-white">
                                {user.username[0]}
                            </div>
                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-slate-800 rounded-full"></div>
                        </div>
                        <span className="text-sm font-medium">{user.username}</span>
                    </div>
                    <button onClick={logout} className="p-2 text-slate-400 hover:text-white transition-colors">
                        <LogOut size={18} />
                    </button>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <AnimatePresence>
                        {messages.map((msg, index) => (
                            <motion.div
                                key={`${index}-${msg.time}`}
                                initial={{ opacity: 0, x: msg.author === user.username ? 20 : -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`flex ${msg.author === user.username ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-md p-3 rounded-2xl ${
                                    msg.author === user.username 
                                    ? 'bg-primary text-white rounded-tr-none' 
                                    : 'bg-slate-800 text-slate-100 rounded-tl-none'
                                } shadow-lg`}>
                                    <div className="text-[10px] opacity-60 mb-1 flex justify-between gap-4">
                                        <span>{msg.author}</span>
                                        <span>{msg.time}</span>
                                    </div>
                                    <p className="text-sm leading-relaxed">{msg.message}</p>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Input Area */}
                <div className="p-4 bg-slate-800 border-t border-slate-700">
                    <div className="max-w-4xl mx-auto flex gap-2">
                        <input
                            type="text"
                            placeholder="Type your message..."
                            className="flex-1 px-4 py-3 bg-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        />
                        <button 
                            onClick={sendMessage}
                            className="p-3 bg-primary rounded-xl hover:bg-opacity-90 transition-all active:scale-90"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Chat;
