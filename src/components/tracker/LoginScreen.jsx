import { useState } from "react";
import { Card, Button, Typography, Alert, Space } from "antd";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../../firebase";

const { Title, Paragraph } = Typography;

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" style={{ display: "block" }}>
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError("Đăng nhập thất bại. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: 400,
        padding: 24,
      }}
    >
      <Card
        style={{ maxWidth: 400, width: "100%", textAlign: "center" }}
        variant="outlined"
      >
        <Space vertical size={16} style={{ width: "100%" }}>
          <div style={{ fontSize: 48 }}>📦</div>
          <Title level={3} style={{ margin: 0 }}>
            Package Tracker
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            Theo dõi đơn SPX Express và nhận thông báo qua Gmail khi có cập nhật
            mới.
          </Paragraph>
          {error && <Alert message={error} type="error" showIcon />}
          <Button
            size="large"
            block
            loading={loading}
            icon={<GoogleIcon />}
            onClick={handleLogin}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            Đăng nhập với Google
          </Button>
        </Space>
      </Card>
    </div>
  );
}
