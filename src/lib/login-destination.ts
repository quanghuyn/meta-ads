// Deliberately allow only our two protected pages; never trust an arbitrary return URL.
export function loginDestination(value:unknown){return value==='/chat-luong-mess'?'/chat-luong-mess':'/bao-cao';}
