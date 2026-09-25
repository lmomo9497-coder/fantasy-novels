import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { supabase } from "./lib/supabase";

type AccountSection =
  | "favorites"
  | "history"
  | "notifications"
  | null;

function App() {
  const [user, setUser] = useState<any>(null);
  const [showAccount, setShowAccount] = useState(false);
  const [activeSection, setActiveSection] =
    useState<AccountSection>(null);

  const [favorites, setFavorites] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingAccountData, setLoadingAccountData] =
    useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadAccountData();
    } else {
      setFavorites([]);
      setHistory([]);
      setNotifications([]);
    }
  }, [user]);

  async function loadAccountData() {
    if (!user) return;

    setLoadingAccountData(true);

    const [
      favoritesResult,
      historyResult,
      notificationsResult,
    ] = await Promise.all([
      supabase
        .from("favorites")
        .select(`
          created_at,
          novels (
            id,
            title,
            description,
            cover_path,
            status,
            language
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),

      supabase
        .from("reading_progress")
        .select(`
          novel_id,
          chapter_id,
          progress_percent,
          updated_at,
          novels (
            id,
            title,
            description,
            cover_path,
            status,
            language
          ),
          chapters (
            id,
            chapter_number,
            title
          )
        `)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),

      supabase
        .from("notifications")
        .select(`
          id,
          title,
          message,
          created_at,
          read_at,
          novels (
            id,
            title
          ),
          chapters (
            id,
            chapter_number,
            title
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (favoritesResult.error) {
      console.error(
        "Favorites:",
        favoritesResult.error
      );
    } else {
      setFavorites(favoritesResult.data || []);
    }

    if (historyResult.error) {
      console.error(
        "History:",
        historyResult.error
      );
    } else {
      setHistory(historyResult.data || []);
    }

    if (notificationsResult.error) {
      console.error(
        "Notifications:",
        notificationsResult.error
      );
    } else {
      setNotifications(
        notificationsResult.data || []
      );
    }

    setLoadingAccountData(false);
  }

  async function signInWithGoogle() {
    const { error } =
      await supabase.auth.signInWithOAuth({
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
    setActiveSection(null);
  }

  async function markNotificationAsRead(
    id: string
  ) {
    const { error } = await supabase
      .from("notifications")
      .update({
        read_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              read_at:
                new Date().toISOString(),
            }
          : notification
      )
    );
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

  const unreadNotifications =
    notifications.filter(
      (notification) =>
        !notification.read_at
    ).length;

  function formatDate(date: string) {
    return new Intl.DateTimeFormat("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(date));
  }

  function toggleSection(
    section: AccountSection
  ) {
    setActiveSection((current) =>
      current === section ? null : section
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>روايات خيالية</h1>
          <span>Fantasy Novels</span>
        </div>

        <nav>
          <button
            onClick={() => {
              setShowAccount(false);
              setActiveSection(null);
            }}
          >
            الرئيسية
          </button>

          <button
            onClick={() => {
              setShowAccount(false);
              setActiveSection(null);
            }}
          >
            الروايات
          </button>

          {user ? (
            <>
              <button
                onClick={() => {
                  setShowAccount(true);
                  setActiveSection(null);
                }}
              >
                👤 حسابي
              </button>

              <button onClick={signOut}>
                تسجيل الخروج
              </button>
            </>
          ) : (
            <button
              onClick={signInWithGoogle}
            >
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
              onClick={() => {
                setShowAccount(false);
                setActiveSection(null);
              }}
            >
              ← العودة للرئيسية
            </button>

            <div className="account-card">
              <div
                style={{
                  textAlign: "center",
                }}
              >
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
                <button
                  className={`account-row-button ${
                    activeSection ===
                    "favorites"
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    toggleSection(
                      "favorites"
                    )
                  }
                >
                  <strong>
                    ❤️ المفضلة
                  </strong>

                  <span>
                    {favorites.length} رواية
                  </span>
                </button>

                <button
                  className={`account-row-button ${
                    activeSection ===
                    "history"
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    toggleSection("history")
                  }
                >
                  <strong>
                    📖 سجل القراءة
                  </strong>

                  <span>
                    {history.length} رواية
                  </span>
                </button>

                <button
                  className={`account-row-button ${
                    activeSection ===
                    "notifications"
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    toggleSection(
                      "notifications"
                    )
                  }
                >
                  <strong>
                    🔔 الإشعارات
                  </strong>

                  <span>
                    {unreadNotifications > 0
                      ? `${unreadNotifications} جديدة`
                      : "لا توجد جديدة"}
                  </span>
                </button>
              </div>

              {loadingAccountData ? (
                <div className="account-loading">
                  جارٍ تحميل بيانات حسابك...
                </div>
              ) : null}

              {activeSection ===
                "favorites" && (
                <div className="account-section">
                  <div className="section-heading">
                    <h2>
                      ❤️ رواياتي المفضلة
                    </h2>

                    <span>
                      {favorites.length}
                    </span>
                  </div>

                  {favorites.length ===
                  0 ? (
                    <div className="panel">
                      لم تضيفي أي رواية إلى
                      المفضلة حتى الآن.
                    </div>
                  ) : (
                    <div className="account-list">
                      {favorites.map(
                        (item) => {
                          const novel =
                            item.novels;

                          if (!novel)
                            return null;

                          return (
                            <div
                              className="account-novel"
                              key={novel.id}
                            >
                              <div className="account-novel-cover">
                                {novel.cover_path ? (
                                  <img
                                    src={
                                      novel.cover_path
                                    }
                                    alt={
                                      novel.title
                                    }
                                  />
                                ) : (
                                  "📖"
                                )}
                              </div>

                              <div className="account-novel-info">
                                <h3>
                                  {
                                    novel.title
                                  }
                                </h3>

                                <p>
                                  {novel.description ||
                                    "لا يوجد وصف للرواية بعد."}
                                </p>

                                <small>
                                  أضيفت في{" "}
                                  {formatDate(
                                    item.created_at
                                  )}
                                </small>

                                <button
                                  className="account-action"
                                  onClick={() =>
                                    alert(
                                      "صفحة قراءة الرواية سنربطها في الخطوة التالية."
                                    )
                                  }
                                >
                                  قراءة الرواية
                                </button>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeSection ===
                "history" && (
                <div className="account-section">
                  <div className="section-heading">
                    <h2>
                      📖 سجل القراءة
                    </h2>

                    <span>
                      {history.length}
                    </span>
                  </div>

                  {history.length ===
                  0 ? (
                    <div className="panel">
                      عندما تبدئين بقراءة
                      رواية، سيظهر تقدمك
                      هنا.
                    </div>
                  ) : (
                    <div className="account-list">
                      {history.map(
                        (item) => {
                          const novel =
                            item.novels;

                          const chapter =
                            item.chapters;

                          if (!novel)
                            return null;

                          const progress =
                            Number(
                              item.progress_percent ||
                                0
                            );

                          return (
                            <div
                              className="account-novel"
                              key={
                                item.novel_id
                              }
                            >
                              <div className="account-novel-cover">
                                {novel.cover_path ? (
                                  <img
                                    src={
                                      novel.cover_path
                                    }
                                    alt={
                                      novel.title
                                    }
                                  />
                                ) : (
                                  "📖"
                                )}
                              </div>

                              <div className="account-novel-info">
                                <h3>
                                  {
                                    novel.title
                                  }
                                </h3>

                                <p>
                                  {chapter
                                    ? `آخر فصل: الفصل ${chapter.chapter_number}${
                                        chapter.title
                                          ? ` — ${chapter.title}`
                                          : ""
                                      }`
                                    : "لم يتم تحديد الفصل بعد."}
                                </p>

                                <div className="progress-bar">
                                  <div
                                    className="progress-fill"
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        Math.max(
                                          0,
                                          progress
                                        )
                                      )}%`,
                                    }}
                                  />
                                </div>

                                <small>
                                  التقدم:{" "}
                                  {Math.round(
                                    progress
                                  )}
                                  %
                                </small>

                                <small>
                                  آخر تحديث:{" "}
                                  {formatDate(
                                    item.updated_at
                                  )}
                                </small>

                                <button
                                  className="account-action"
                                  onClick={() =>
                                    alert(
                                      "سنربط زر متابعة القراءة بصفحة الرواية في الخطوة التالية."
                                    )
                                  }
                                >
                                  متابعة القراءة
                                </button>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeSection ===
                "notifications" && (
                <div className="account-section">
                  <div className="section-heading">
                    <h2>
                      🔔 الإشعارات
                    </h2>

                    <span>
                      {unreadNotifications} جديدة
                    </span>
                  </div>

                  {notifications.length ===
                  0 ? (
                    <div className="panel">
                      لا توجد إشعارات حتى
                      الآن.
                    </div>
                  ) : (
                    <div className="notification-list">
                      {notifications.map(
                        (notification) => (
                          <div
                            className={`notification-item ${
                              !notification.read_at
                                ? "unread"
                                : ""
                            }`}
                            key={
                              notification.id
                            }
                          >
                            <div>
                              <h3>
                                {
                                  notification.title
                                }
                              </h3>

                              {notification.message ? (
                                <p>
                                  {
                                    notification.message
                                  }
                                </p>
                              ) : null}

                              {notification
                                .novels
                                ?.title ? (
                                <small>
                                  الرواية:{" "}
                                  {
                                    notification
                                      .novels
                                      .title
                                  }
                                </small>
                              ) : null}

                              {notification.chapters ? (
                                <small>
                                  الفصل:{" "}
                                  {
                                    notification
                                      .chapters
                                      .chapter_number
                                  }

                                  {notification
                                    .chapters
                                    .title
                                    ? ` — ${notification.chapters.title}`
                                    : ""}
                                </small>
                              ) : null}

                              <small>
                                {formatDate(
                                  notification.created_at
                                )}
                              </small>
                            </div>

                            {!notification.read_at ? (
                              <button
                                className="notification-read"
                                onClick={() =>
                                  markNotificationAsRead(
                                    notification.id
                                  )
                                }
                              >
                                تحديد كمقروء
                              </button>
                            ) : (
                              <span className="read-label">
                                مقروء
                              </span>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="account-section">
                <h2>نوع الحساب</h2>

                <div className="panel account-role">
                  <strong>
                    قارئ
                  </strong>

                  <span>
                    حساب قراءة عادي، بدون
                    صلاحيات الإدارة.
                  </span>
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
              <p>
                مرحبًا بك في
              </p>

              <h2>
                عالم الروايات الخيالية
              </h2>

              <p>
                مكان هادئ لقراءة الروايات
                واكتشاف العوالم والشخصيات
                والقصص الجديدة.
              </p>

              <button className="main-button">
                تصفح الروايات
              </button>
            </section>

            <section className="novels">
              <h2>
                أحدث الروايات
              </h2>

              <div className="novel-card">
                <div className="cover">
                  📖
                </div>

                <div>
                  <span className="category">
                    فانتازيا
                  </span>

                  <h3>
                    رواية تجريبية
                  </h3>

                  <p>
                    هذه مساحة مؤقتة ستتحول
                    لاحقًا إلى رواياتك
                    الحقيقية.
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

createRoot(
  document.getElementById("root")!
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
