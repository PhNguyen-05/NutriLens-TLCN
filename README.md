# NutriLens - Hệ thống theo dõi sức khỏe và dinh dưỡng dựa trên công nghệ nhận diện hình ảnh món ăn


## 📖 Giới thiệu dự án
NutriLens là một ứng dụng web giúp người dùng theo dõi sức khỏe, quản lý dinh dưỡng và ghi nhận hoạt động thể chất. Điểm nổi bật của hệ thống là khả năng tự động nhận diện món ăn từ hình ảnh thông qua mô hình học sâu (Deep Learning/CNN), từ đó ước tính lượng calo và thành phần dinh dưỡng (Protein, Carb, Fat) một cách nhanh chóng[cite: 5].


## 👥 Đội ngũ phát triển
*   **Sinh viên thực hiện:** 
    *   Nguyễn Thị Hoàng Kim (MSSV: 23110248)
    *   Trần Hồ Phương Nguyên (MSSV: 23110271)


## 🛠 Công nghệ sử dụng
Hệ thống được thiết kế với kiến trúc phân tách rõ ràng giữa Frontend, Backend và AI Service:
*   **Frontend:** React.js
*   **Backend (API Server):** Node.js / Express.js
*   **Cơ sở dữ liệu:** MongoDB (Thiết kế 18 collections với cơ chế lưu trữ snapshot và tham chiếu)
*   **AI Service:** Python / FastAPI kết hợp mô hình Mạng nơ-ron tích chập (CNN)


## ✨ Tính năng nổi bật
### 👤 Đối với Người dùng (User)
*   Đăng ký, đăng nhập bảo mật bằng Email/Mật khẩu hoặc Google OAuth2
*   Thiết lập hồ sơ sức khỏe và tự động tính toán các chỉ số: BMI, BMR, TDEE
*   Tải lên hoặc chụp ảnh món ăn để AI tự động nhận diện, trả về thông tin dinh dưỡng
*   Ghi nhật ký bữa ăn hàng ngày theo định lượng khẩu phần thực tế
*   Ghi nhận hoạt động tập luyện thể chất và ước tính lượng calo tiêu hao
*   Xem biểu đồ thống kê sức khỏe, dinh dưỡng và tiến độ tập luyện theo Ngày/Tuần/Tháng
*   Tham gia tương tác trên Community (Đăng bài, Bình luận) và đọc bài viết Blog


### 👑 Đối với Quản trị viên (Admin)
*   Quản lý danh sách tài khoản người dùng, thực hiện khóa hoặc mở khóa tài khoản
*   Quản lý danh mục món ăn chuẩn và duyệt các yêu cầu thêm món ăn mới từ người dùng
*   Quản lý danh mục bài tập (Exercise)
*   Kiểm duyệt bài đăng trên Community và quản lý nội dung xuất bản trên Blog
*   Theo dõi Dashboard tổng quan về các số liệu thống kê hoạt động của hệ thống


## 🗄 Cấu trúc Cơ sở dữ liệu
Hệ thống sử dụng MongoDB với 18 collections, được tổ chức thành 5 nhóm module chính
1.  **Nhóm Tài khoản & Hồ sơ:** User, UserProfile, WeightLog, NutritionGoal, RefreshToken
2.  **Nhóm Món ăn & AI:** FoodItem, FoodRequest, MealLog, AIRecognitionLog
3.  **Nhóm Tập luyện:** Exercise, ExerciseLog
4.  **Nhóm Cộng đồng & Blog:** Post, Comment, Like, Report, BlogPost
5.  **Nhóm Hệ thống chung:** Notification, AdminActionLog
