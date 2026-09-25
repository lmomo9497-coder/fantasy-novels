import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { supabase } from "./lib/supabase";

function App() {
  const [user, setUser] = useState<any>(null);
  const [showAccount, setShowAccount] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      alert("حدث خطأ أثناء تسجيل الدخول");
      console.error(error);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setShowAccount(false);
  }

  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "حسابي";

  const userAvatar =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    null;

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>روايات خيالية</h1>
          <span>Fantasy Novels</span>
        </div>

        <nav>
          <button onClick={() => setShowAccount(false)}>
            الرئيسية
          </button>

          <button onClick={() => setShowAccount(false)}>
            الروايات
          </button>

          {user ? (
            <>
              <button onClick={() => setShowAccount(true)}>
                👤 حسابي
              </button>

              <button onClick={signOut}>
                تسجيل الخروج
              </button>
            </>
          ) : (
            <button onClick={signInWithGoogle}>
              تسجيل الدخول بحساب Google
            </button>
          )}
        </nav>
      </header>

      <main>
        {showAccount && user ? (
          <section className="account-page">
            <button
              className="secondary"
              onClick={() => setShowAccount(false)}
            >
              ← العودة للرئيسية
            </button>

            <div className="account-card">
              <div style={{ textAlign: "center" }}>
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt="صورة الحساب"
                    className="account-avatar"
                  />
                ) : (
                  <div className="account-avatar-placeholder">
                    👤
                  </div>
                )}

                <h2>{userName}</h2>

                <p className="account-muted">
                  {user.email}
                </p>
              </div>

              <div className="account-info">
                <div className="account-row">
                  <strong>نوع الحساب</strong>
                  <span>قارئ</span>
                </div>

                <div className="account-row">
                  <strong>المفضلة</strong>
                  <span>لا توجد روايات بعد</span>
                </div>

                <div className="account-row">
                  <strong>آخر قراءة</strong>
                  <span>لا يوجد سجل قراءة بعد</span>
                </div>

                <div className="account-row">
                  <strong>الإشعارات</strong>
                  <span>لا توجد إشعارات جديدة</span>
                </div>
              </div>

              <div className="account-section">
                <h2>المفضلة</h2>

                <div className="panel">
                  لم تضيفي أي رواية إلى المفضلة حتى الآن.
                </div>
              </div>

              <div className="account-section">
                <h2>سجل القراءة</h2>

                <div className="panel">
                  عندما تبدئين بقراءة رواية، سيظهر تقدمك هنا.
                </div>
              </div>

              <div className="account-section">
                <h2>الإشعارات</h2>

                <div className="panel">
                  ستظهر هنا إشعارات الفصول الجديدة.
                </div>
              </div>

              <button
                onClick={signOut}
                className="logout-button"
              >
                تسجيل الخروج
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="hero">
              <p>مرحبًا بك في</p>

              <h2>عالم الروايات الخيالية</h2>

              <p>
                مكان هادئ لقراءة الروايات واكتشاف العوالم
                والشخصيات والقصص الجديدة.
              </p>

              <button className="main-button">
                تصفح الروايات
              </button>
            </section>

            <section className="novels">
              <h2>أحدث الروايات</h2>

              <div className="novel-card">
                <div className="cover">📖</div>

                <div>
                  <span className="category">
                    فانتازيا
                  </span>

                  <h3>رواية تجريبية</h3>

                  <p>
                    هذه مساحة مؤقتة ستتحول لاحقًا إلى
                    رواياتك الحقيقية.
                  </p>

                  <button>
                    قراءة الرواية
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <footer>
        © 2026 روايات خيالية
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
