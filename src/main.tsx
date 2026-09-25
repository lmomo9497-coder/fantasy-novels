import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { supabase } from "./lib/supabase";

type AccountSection =
  | "favorites"
  | "history"
  | "notifications"
  | null;

type Profile = {
  role: "owner" | "staff" | "reader";
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type Novel = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_path: string | null;
  category_id: string | null;
  status: "ongoing" | "completed";
  language: string;
  direction: "rtl" | "ltr";
  published: boolean;
  created_by: string | null;
  created_at: string;
};

type Category = {
  id: string;
  name: string;
  slug: string;
};

function makeSlug(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\u0600-\u06FFa-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [showAccount, setShowAccount] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [activeSection, setActiveSection] =
    useState<AccountSection>(null);

  const [favorites, setFavorites] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingAccountData, setLoadingAccountData] =
    useState(false);

  const [novels, setNovels] = useState<Novel[]>([]);
  const [categories, setCategories] =
    useState<Category[]>([]);

  const [showNovelForm, setShowNovelForm] =
    useState(false);

  const [savingNovel, setSavingNovel] =
    useState(false);

  const [novelTitle, setNovelTitle] =
    useState("");

  const [novelDescription, setNovelDescription] =
    useState("");

  const [novelCategory, setNovelCategory] =
    useState("");

  const [novelStatus, setNovelStatus] =
    useState<"ongoing" | "completed">(
      "ongoing"
    );

  const [novelLanguage, setNovelLanguage] =
    useState("ar");

  const [novelDirection, setNovelDirection] =
    useState<"rtl" | "ltr">("rtl");

  const [novelPublished, setNovelPublished] =
    useState(false);

  const [novelMessage, setNovelMessage] =
    useState("");

  useEffect(() => {
    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);

        if (session?.user) {
          loadProfile(session.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function loadSession() {
    const { data } =
      await supabase.auth.getSession();

    const currentUser =
      data.session?.user ?? null;

    setUser(currentUser);

    if (currentUser) {
      await loadProfile(currentUser.id);
    }
  }

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "role, display_name, avatar_url, bio"
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Profile:", error);
      return;
    }

    setProfile(data);
  }

  useEffect(() => {
    if (user) {
      loadAccountData();
    } else {
      setFavorites([]);
      setHistory([]);
      setNotifications([]);
    }
  }, [user]);

  useEffect(() => {
    if (showAdmin && isAdmin()) {
      loadAdminData();
    }
  }, [showAdmin]);

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
        .order("created_at", {
          ascending: false,
        }),

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
        .order("updated_at", {
          ascending: false,
        }),

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
        .order("created_at", {
          ascending: false,
        }),
    ]);

    if (!favoritesResult.error) {
      setFavorites(
        favoritesResult.data || []
      );
    }

    if (!historyResult.error) {
      setHistory(
        historyResult.data || []
      );
    }

    if (!notificationsResult.error) {
      setNotifications(
        notificationsResult.data || []
      );
    }

    setLoadingAccountData(false);
  }

  async function loadAdminData() {
    const [novelsResult, categoriesResult] =
      await Promise.all([
        supabase
          .from("novels")
          .select(`
            id,
            title,
            slug,
            description,
            cover_path,
            category_id,
            status,
            language,
            direction,
            published,
            created_by,
            created_at
          `)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("categories")
          .select("id, name, slug")
          .order("name"),
      ]);

    if (novelsResult.error) {
      console.error(
        "Novels:",
        novelsResult.error
      );
    } else {
      setNovels(
        novelsResult.data || []
      );
    }

    if (categoriesResult.error) {
      console.error(
        "Categories:",
        categoriesResult.error
      );
    } else {
      setCategories(
        categoriesResult.data || []
      );
    }
  }

  function isAdmin() {
    return (
      profile?.role === "owner" ||
      profile?.role === "staff"
    );
  }

  async function saveNovel() {
    if (!user || !isAdmin()) return;

    setNovelMessage("");

    const title = novelTitle.trim();
    const description =
      novelDescription.trim();
    const categoryName =
      novelCategory.trim();

    if (!title) {
      setNovelMessage(
        "اكتبي اسم الرواية أولًا."
      );
      return;
    }

    if (!categoryName) {
      setNovelMessage(
        "اكتبي تصنيف الرواية."
      );
      return;
    }

    const slug = makeSlug(title);

    if (!slug) {
      setNovelMessage(
        "تعذر إنشاء رابط للرواية. جربي اسمًا مختلفًا."
      );
      return;
    }

    setSavingNovel(true);

    try {
      let categoryId: string | null = null;

      const existingCategory =
        categories.find(
          (category) =>
            category.name.trim() ===
            categoryName
        );

      if (existingCategory) {
        categoryId = existingCategory.id;
      } else {
        const categorySlug =
          makeSlug(categoryName);

        const {
          data: newCategory,
          error: categoryError,
        } = await supabase
          .from("categories")
          .insert({
            name: categoryName,
            slug: categorySlug,
          })
          .select(
            "id, name, slug"
          )
          .single();

        if (categoryError) {
          if (
            categoryError.code ===
            "23505"
          ) {
            const { data: foundCategory } =
              await supabase
                .from("categories")
                .select(
                  "id, name, slug"
                )
                .eq(
                  "slug",
                  categorySlug
                )
                .maybeSingle();

            if (foundCategory) {
              categoryId =
                foundCategory.id;
            } else {
              throw categoryError;
            }
          } else {
            throw categoryError;
          }
        } else {
          categoryId =
            newCategory.id;

          setCategories((current) => [
            ...current,
            newCategory,
          ]);
        }
      }

      const {
        data: createdNovel,
        error: novelError,
      } = await supabase
        .from("novels")
        .insert({
          title,
          slug,
          description:
            description || null,
          category_id: categoryId,
          status: novelStatus,
          language: novelLanguage,
          direction: novelDirection,
          published: novelPublished,
          created_by: user.id,
        })
        .select(`
          id,
          title,
          slug,
          description,
          cover_path,
          category_id,
          status,
          language,
          direction,
          published,
          created_by,
          created_at
        `)
        .single();

      if (novelError) {
        if (
          novelError.code ===
          "23505"
        ) {
          setNovelMessage(
            "يوجد بالفعل رواية تستخدم هذا الاسم أو الرابط."
          );
        } else {
          console.error(
            "Create novel:",
            novelError
          );

          setNovelMessage(
            "حدث خطأ أثناء حفظ الرواية."
          );
        }

        return;
      }

      setNovels((current) => [
        createdNovel,
        ...current,
      ]);

      setNovelTitle("");
      setNovelDescription("");
      setNovelCategory("");
      setNovelStatus("ongoing");
      setNovelLanguage("ar");
      setNovelDirection("rtl");
      setNovelPublished(false);

      setNovelMessage(
        "تم حفظ الرواية بنجاح."
      );
    } catch (error) {
      console.error(error);

      setNovelMessage(
        "حدث خطأ أثناء إنشاء الرواية."
      );
    } finally {
      setSavingNovel(false);
    }
  }

  async function signInWithGoogle() {
    const { error } =
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo:
            window.location.origin,
        },
      });

    if (error) {
      alert(
        "حدث خطأ أثناء تسجيل الدخول"
      );
      console.error(error);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();

    setUser(null);
    setProfile(null);
    setShowAccount(false);
    setShowAdmin(false);
    setActiveSection(null);
  }

  async function markNotificationAsRead(
    id: string
  ) {
    if (!user) return;

    const now =
      new Date().toISOString();

    const { error } = await supabase
      .from("notifications")
      .update({
        read_at: now,
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
              read_at: now,
            }
          : notification
      )
    );
  }

  const userName =
    profile?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "حسابي";

  const userAvatar =
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    null;

  const role =
    profile?.role || "reader";

  const isOwner =
    role === "owner";

  const isStaff =
    role === "staff";

  const admin =
    isOwner || isStaff;

  const unreadNotifications =
    notifications.filter(
      (notification) =>
        !notification.read_at
    ).length;

  function formatDate(date: string) {
    return new Intl.DateTimeFormat(
      "ar-SA",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    ).format(new Date(date));
  }

  function toggleSection(
    section: AccountSection
  ) {
    setActiveSection((current) =>
      current === section
        ? null
        : section
    );
  }

  function closeAllPages() {
    setShowAccount(false);
    setShowAdmin(false);
    setActiveSection(null);
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>
            روايات خيالية
          </h1>

          <span>
            Fantasy Novels
          </span>
        </div>

        <nav>
          <button
            onClick={closeAllPages}
          >
            الرئيسية
          </button>

          <button
            onClick={closeAllPages}
          >
            الروايات
          </button>

          {user ? (
            <>
              {admin && (
                <button
                  onClick={() => {
                    setShowAdmin(true);
                    setShowAccount(false);
                    setActiveSection(null);
                  }}
                >
                  🛠️ لوحة الإدارة
                </button>
              )}

              <button
                onClick={() => {
                  setShowAccount(true);
                  setShowAdmin(false);
                  setActiveSection(null);
                }}
              >
                👤 حسابي
              </button>

              <button
                onClick={signOut}
              >
                تسجيل الخروج
              </button>
            </>
          ) : (
            <button
              onClick={
                signInWithGoogle
              }
            >
              تسجيل الدخول بحساب Google
            </button>
          )}
        </nav>
      </header>

      <main>
        {showAdmin &&
        user &&
        admin ? (
          <section className="account-page">
            <button
              onClick={() => {
                setShowAdmin(false);
              }}
            >
              ← العودة
            </button>

            <div className="account-card">
              <h2>
                {isOwner
                  ? "👑 لوحة المالك"
                  : "🛠️ لوحة المشرف"}
              </h2>

              <p className="account-muted">
                مرحبًا {userName}
              </p>

              <div className="account-section">
                <div className="panel account-role">
                  <strong>
                    {isOwner
                      ? "Owner — مالك الموقع"
                      : "Staff — مشرف"}
                  </strong>

                  <span>
                    {isOwner
                      ? "لديك صلاحيات المالك."
                      : "لديك صلاحيات المشرف."}
                  </span>
                </div>
              </div>

              <div className="account-section">
                <div className="section-heading">
                  <h2>
                    📚 إدارة الروايات
                  </h2>

                  <span>
                    {novels.length}
                  </span>
                </div>

                <button
                  className="main-button"
                  onClick={() => {
                    setShowNovelForm(
                      (current) =>
                        !current
                    );
                    setNovelMessage("");
                  }}
                >
                  {showNovelForm
                    ? "إغلاق نموذج الإضافة"
                    : "➕ إضافة رواية"}
                </button>
              </div>

              {showNovelForm && (
                <div className="account-section">
                  <div className="account-card">
                    <h2>
                      ➕ إضافة رواية جديدة
                    </h2>

                    <div
                      style={{
                        display: "grid",
                        gap: "15px",
                      }}
                    >
                      <label>
                        <strong>
                          اسم الرواية
                        </strong>

                        <input
                          value={
                            novelTitle
                          }
                          onChange={(event) =>
                            setNovelTitle(
                              event.target
                                .value
                            )
                          }
                          placeholder="مثال: لعنة القلعة"
                          style={{
                            width: "100%",
                            marginTop: "7px",
                            padding: "12px",
                            borderRadius:
                              "8px",
                            border:
                              "1px solid #444",
                            background:
                              "#111",
                            color:
                              "#fff",
                            fontFamily:
                              "inherit",
                          }}
                        />
                      </label>

                      <label>
                        <strong>
                          الوصف
                        </strong>

                        <textarea
                          value={
                            novelDescription
                          }
                          onChange={(event) =>
                            setNovelDescription(
                              event.target
                                .value
                            )
                          }
                          placeholder="اكتبي وصف الرواية..."
                          rows={5}
                          style={{
                            width: "100%",
                            marginTop: "7px",
                            padding: "12px",
                            borderRadius:
                              "8px",
                            border:
                              "1px solid #444",
                            background:
                              "#111",
                            color:
                              "#fff",
                            fontFamily:
                              "inherit",
                            resize:
                              "vertical",
                          }}
                        />
                      </label>

                      <label>
                        <strong>
                          التصنيف
                        </strong>

                        <input
                          value={
                            novelCategory
                          }
                          onChange={(event) =>
                            setNovelCategory(
                              event.target
                                .value
                            )
                          }
                          placeholder="مثال: فانتازيا"
                          list="novel-categories"
                          style={{
                            width: "100%",
                            marginTop: "7px",
                            padding: "12px",
                            borderRadius:
                              "8px",
                            border:
                              "1px solid #444",
                            background:
                              "#111",
                            color:
                              "#fff",
                            fontFamily:
                              "inherit",
                          }}
                        />

                        <datalist id="novel-categories">
                          {categories.map(
                            (category) => (
                              <option
                                key={
                                  category.id
                                }
                                value={
                                  category.name
                                }
                              />
                            )
                          )}
                        </datalist>
                      </label>

                      <label>
                        <strong>
                          حالة الرواية
                        </strong>

                        <select
                          value={
                            novelStatus
                          }
                          onChange={(event) =>
                            setNovelStatus(
                              event.target
                                .value as
                                | "ongoing"
                                | "completed"
                            )
                          }
                          style={{
                            width: "100%",
                            marginTop: "7px",
                            padding: "12px",
                            borderRadius:
                              "8px",
                            border:
                              "1px solid #444",
                            background:
                              "#111",
                            color:
                              "#fff",
                            fontFamily:
                              "inherit",
                          }}
                        >
                          <option value="ongoing">
                            مستمرة
                          </option>

                          <option value="completed">
                            مكتملة
                          </option>
                        </select>
                      </label>

                      <label>
                        <strong>
                          لغة الرواية
                        </strong>

                        <select
                          value={
                            novelLanguage
                          }
                          onChange={(event) =>
                            setNovelLanguage(
                              event.target
                                .value
                            )
                          }
                          style={{
                            width: "100%",
                            marginTop: "7px",
                            padding: "12px",
                            borderRadius:
                              "8px",
                            border:
                              "1px solid #444",
                            background:
                              "#111",
                            color:
                              "#fff",
                            fontFamily:
                              "inherit",
                          }}
                        >
                          <option value="ar">
                            العربية
                          </option>

                          <option value="en">
                            English
                          </option>

                          <option value="ko">
                            한국어
                          </option>
                        </select>
                      </label>

                      <label>
                        <strong>
                          اتجاه الرواية
                        </strong>

                        <select
                          value={
                            novelDirection
                          }
                          onChange={(event) =>
                            setNovelDirection(
                              event.target
                                .value as
                                | "rtl"
                                | "ltr"
                            )
                          }
                          style={{
                            width: "100%",
                            marginTop: "7px",
                            padding: "12px",
                            borderRadius:
                              "8px",
                            border:
                              "1px solid #444",
                            background:
                              "#111",
                            color:
                              "#fff",
                            fontFamily:
                              "inherit",
                          }}
                        >
                          <option value="rtl">
                            من اليمين لليسار
                          </option>

                          <option value="ltr">
                            من اليسار لليمين
                          </option>
                        </select>
                      </label>

                      <label
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap: "10px",
                          cursor:
                            "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={
                            novelPublished
                          }
                          onChange={(event) =>
                            setNovelPublished(
                              event.target
                                .checked
                            )
                          }
                        />

                        <strong>
                          نشر الرواية الآن
                        </strong>
                      </label>

                      {novelMessage && (
                        <div className="panel">
                          {novelMessage}
                        </div>
                      )}

                      <button
                        className="main-button"
                        disabled={
                          savingNovel
                        }
                        onClick={
                          saveNovel
                        }
                      >
                        {savingNovel
                          ? "جارٍ الحفظ..."
                          : "💾 حفظ الرواية"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="account-section">
                <h2>
                  الروايات الموجودة
                </h2>

                {novels.length ===
                0 ? (
                  <div className="panel">
                    لا توجد روايات حتى الآن.
                    أضيفي أول رواية من الزر
                    بالأعلى.
                  </div>
                ) : (
                  <div className="account-list">
                    {novels.map(
                      (novel) => {
                        const category =
                          categories.find(
                            (item) =>
                              item.id ===
                              novel.category_id
                          );

                        return (
                          <div
                            className="panel"
                            key={
                              novel.id
                            }
                            style={{
                              display:
                                "grid",
                              gap: "8px",
                            }}
                          >
                            <h3
                              style={{
                                margin:
                                  "0",
                              }}
                            >
                              {novel.title}
                            </h3>

                            <span className="account-muted">
                              {category
                                ? `التصنيف: ${category.name}`
                                : "بدون تصنيف"}
                            </span>

                            <span className="account-muted">
                              الحالة:{" "}
                              {novel.status ===
                              "ongoing"
                                ? "مستمرة"
                                : "مكتملة"}
                            </span>

                            <span className="account-muted">
                              {novel.published
                                ? "🟢 منشورة"
                                : "⚪ غير منشورة"}
                            </span>

                            {novel.description && (
                              <p
                                style={{
                                  margin:
                                    "5px 0 0",
                                  lineHeight:
                                    "1.7",
                                  color:
                                    "#aaa",
                                }}
                              >
                                {
                                  novel.description
                                }
                              </p>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : showAccount &&
          user ? (
          <section className="account-page">
            <button
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
                  textAlign:
                    "center",
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

                <h2>
                  {userName}
                </h2>

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
                    toggleSection(
                      "history"
                    )
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
                    {unreadNotifications >
                    0
                      ? `${unreadNotifications} جديدة`
                      : "لا توجد جديدة"}
                  </span>
                </button>
              </div>

              {loadingAccountData && (
                <div className="account-loading">
                  جارٍ تحميل بيانات حسابك...
                </div>
              )}

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
                      لم تضف أي رواية إلى
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
                              key={
                                novel.id
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
                                  {novel.description ||
                                    "لا يوجد وصف للرواية بعد."}
                                </p>

                                <small>
                                  أضيفت في{" "}
                                  {formatDate(
                                    item.created_at
                                  )}
                                </small>
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
                      عندما تبدأ بقراءة رواية،
                      سيظهر تقدمك هنا.
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
                      {unreadNotifications}
                    </span>
                  </div>

                  {notifications.length ===
                  0 ? (
                    <div className="panel">
                      لا توجد إشعارات حتى الآن.
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

                              {notification.message && (
                                <p>
                                  {
                                    notification.message
                                  }
                                </p>
                              )}

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
                <h2>
                  نوع الحساب
                </h2>

                <div className="panel account-role">
                  <strong>
                    {isOwner
                      ? "👑 مالك الموقع"
                      : isStaff
                      ? "🛠️ مشرف"
                      : "👤 قارئ"}
                  </strong>

                  <span>
                    {isOwner
                      ? "لديك صلاحيات المالك."
                      : isStaff
                      ? "لديك صلاحيات المشرف."
                      : "حساب قراءة عادي."}
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
