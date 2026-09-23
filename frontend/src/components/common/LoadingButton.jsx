/**
 * Nút submit có trạng thái loading tích hợp.
 * Hiển thị spinner + text "Đang xử lý..." khi loading=true.
 *
 * @param {boolean}  loading   - Trạng thái đang gửi request
 * @param {string}   className - Bootstrap classes cho button
 * @param {string}   loadingText - Text hiển thị khi loading (mặc định "Đang xử lý...")
 * @param {ReactNode} children - Nội dung button khi không loading
 *
 * @example
 * <LoadingButton loading={isSubmitting} className="btn btn-brand w-100 py-2">
 *   Đăng nhập
 * </LoadingButton>
 */
export default function LoadingButton({
  loading = false,
  loadingText = 'Đang xử lý...',
  className = 'btn btn-brand w-100',
  children,
  ...rest
}) {
  return (
    <button className={className} disabled={loading || rest.disabled} {...rest}>
      {loading ? (
        <>
          <span
            className="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
          />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  )
}
