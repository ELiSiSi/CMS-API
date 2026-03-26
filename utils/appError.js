class AppError extends Error {
  constructor(message, statusCode, reason, errors) {
    super(message);
    this.statusCode = statusCode;
    this.reason     = reason;
    this.errors     = errors || null;
    this.message_en = message ;
    this.message_fa = message;
    this.message_ar = message;
  }
}
export default AppError;

