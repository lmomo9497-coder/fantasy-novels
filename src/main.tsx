import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { supabase } from "./lib/supabase";

function App() {
  const [user, setUser] = useState<any>(null);

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
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "حسابي";

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>روايات خيالية</h1>
          <span>Fantasy Novels</span>
        </div>

        <nav>
          <button>الرئيسية</button>
          <button>الروايات</button>

          {user ? (
            <>
              <button>👤 {userName}</button>
              <button onClick={signOut}>تسجيل الخروج</button>
            </>
          ) : (
            <button onClick={signInWithGoogle}>
              تسجيل الدخول بحساب Google
            </button>
          )}
        </nav>
      </header>

      <main>
        <section className="hero">
          <p>مرحبًا بك في</p>
          <h2>عالم الروايات الخيالية</h2>
          <p>
            مكان هادئ لقراءة الروايات واكتشاف العوالم والشخصيات والقصص الجديدة.
          </p>

          <button className="main-button">تصفح الروايات</button>
        </section>

        <section className="novels">
          <h2>أحدث الروايات</h2>

          <div className="novel-card">
            <div className="cover">📖</div>

            <div>
              <span className="category">فانتازيا</span>
              <h3>رواية تجريبية</h3>
              <p>
                هذه مساحة مؤقتة ستتحول لاحقًا إلى رواياتك الحقيقية.
              </p>
              <button>قراءة الرواية</button>
            </div>
          </div>
        </section>
      </main>

      <footer>© 2026 روايات خيالية</footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
