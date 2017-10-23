export convertProgressStatus = (status) => {
  switch (parseInt(status, 16)) {
    case 0x804B0008: return "STATUS_READING";
    case 0x804B0009: return "STATUS_WRITING";
    case 0x804b0003: return "STATUS_RESOLVING";
    case 0x804b000b: return "STATUS_RESOLVED";
    case 0x804b0007: return "STATUS_CONNECTING_TO";
    case 0x804b0004: return "STATUS_CONNECTED_TO";
    case 0x804B000C: return "STATUS_TLS_HANDSHAKE_STARTING";
    case 0x804B000D: return "STATUS_TLS_HANDSHAKE_ENDED";
    case 0x804b0005: return "STATUS_SENDING_TO";
    case 0x804b000a: return "STATUS_WAITING_FOR";
    case 0x804b0006: return "STATUS_RECEIVING_FROM";
    default: return status;
  }
};
