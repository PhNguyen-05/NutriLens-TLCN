require('dotenv').config();
const connectDB = require('./config/db');

connectDB()
  .then(() => {
    app.listen(process.env.PORT || 5000, () => {
      console.log(`Server đang chạy ở cổng ${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => {
    console.error('Không thể khởi động server:', err.message);
    process.exit(1);
  });