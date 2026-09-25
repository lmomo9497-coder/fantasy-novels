
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { supabase } from "./lib/supabase";

type Role = "owner" | "staff" | "reader";

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: Role;
};

type Category = {
  id: string;
  name: string;
  slug: string;
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
  categories?: Category | null;
};

type StaffMember = {
  id: string;
  display_name: string | null;
  role: Role;
  email?: string | null;
};

type AccountSection =
  | "profile"
  | "favorites"
  | "history"
  | "notifications";

function makeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [showAccount, setShowAccount] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showNovels, setShowNovels] = useState(true);

  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);

  const [activeSection, setActiveSection] =
    useState<AccountSection>("profile");

  const [favorites, setFavorites] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  const [loadingAccountData, setLoadingAccountData] = useState(false);

  const [novels, setNovels] = useState<Novel[]>([]);
  const [publishedNovels, setPublishedNovels] = useState<Novel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [showNovelForm, setShowNovelForm] = useState(false);
  const [savingNovel, setSavingNovel] = useState(false);

  const [novelTitle, setNovelTitle] = useState("");
  const [novelDescription, setNovelDescription] = useState("");
  const [novelCategory, setNovelCategory] = useState("");
  const [novelStatus, setNovelStatus] =
    useState<"ongoing" | "completed">("ongoing");
  const [novelLanguage, setNovelLanguage] = useState("العربية");
  const [novelDirection, setNovelDirection] =
    useState<"rtl" | "ltr">("rtl");

  const [novelMessage, setNovelMessage] = useState("");

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffMessage, setStaffMessage] = useState("");
  const [managingStaff, setManagingStaff] = useState(false);

  const isOwner = profile?.role === "owner";
  const isStaff = profile?.role === "staff";
  const canManageNovels = isOwner || isStaff;

  useEffect(() => {
    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    loadPublishedNovels();
    loadCategories();
  }, []);

  useEffect(() => {
    if (canManageNovels) {
      loadAdminData();
    }
  }, [profile?.role]);

  useEffect(() => {
    if (user) {
      loadAccountData();
    }
  }, [user]);

  async function loadSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    setUser(session?.user ?? null);

    if (session?.user) {
      await loadProfile(session.user.id);
    }
  }

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("id,display_name,avatar_url,bio,role")
      .eq("id", userId)
      .maybeSingle();

    if (data) {
      setProfile(data as Profile);
    }
  }

  async function loadCategories() {
    const { data } = await supabase
      .from("categories")
      .select("id,name,slug")
      .order("name");

    if (data) {
      setCategories(data as Category[]);
    }
  }

  async function loadPublishedNovels() {
    const { data } = await supabase
      .from("novels")
      .select(
        `
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
        created_at,
        categories(id,name,slug)
      `
      )
      .eq("published", true)
      .order("created_at", { ascending: false });

    if (data) {
      setPublishedNovels(data as Novel[]);
    }
  }

  async function loadAdminData() {
    if (!canManageNovels) return;

    const { data } = await supabase
      .from("novels")
      .select(
        `
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
        created_at,
        categories(id,name,slug)
      `
      )
      .order("created_at", { ascending: false });

    if (data) {
      setNovels(data as Novel[]);
    }

    await loadCategories();

    if (isOwner) {
      await loadStaffMembers();
    }
  }

  async function loadStaffMembers() {
    if (!isOwner) return;

    setLoadingStaff(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "manage-staff",
        {
          body: {
            action: "list",
          },
        }
      );

      if (!error && data?.staff) {
        setStaffMembers(data.staff);
      }
    } finally {
      setLoadingStaff(false);
    }
  }

  async function loadAccountData() {
    if (!user) return;

    setLoadingAccountData(true);

    try {
      const [fav, hist, notif] = await Promise.all([
        supabase
          .from("favorites")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("reading_progress")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),

        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      setFavorites(fav.data ?? []);
      setHistory(hist.data ?? []);
      setNotifications(notif.data ?? []);
    } finally {
      setLoadingAccountData(false);
    }
  }

  async function saveNovel(publish: boolean) {
    if (!user || !canManageNovels) {
      setNovelMessage("ليس لديك صلاحية لإضافة الروايات.");
      return;
    }

    if (!novelTitle.trim()) {
      setNovelMessage("اكتبي اسم الرواية أولًا.");
      return;
    }

    if (!novelCategory.trim()) {
      setNovelMessage("اكتبي تصنيف الرواية.");
      return;
    }

    setSavingNovel(true);
    setNovelMessage("");

    try {
      let categoryId: string | null = null;

      const existingCategory = categories.find(
        (category) =>
          category.name.trim().toLowerCase() ===
          novelCategory.trim().toLowerCase()
      );

      if (existingCategory) {
        categoryId = existingCategory.id;
      } else {
        const { data: newCategory, error: categoryError } =
          await supabase
            .from("categories")
            .insert({
              name: novelCategory.trim(),
              slug: makeSlug(novelCategory),
            })
            .select("id,name,slug")
            .single();

        if (categoryError) {
          setNovelMessage(
            categoryError.message ||
              "حدث خطأ أثناء إنشاء التصنيف."
          );
          return;
        }

        categoryId = newCategory.id;
        setCategories((current) => [
          ...current,
          newCategory as Category,
        ]);
      }

      const baseSlug = makeSlug(novelTitle) || `novel-${Date.now()}`;

      const { error } = await supabase.from("novels").insert({
        title: novelTitle.trim(),
        slug: `${baseSlug}-${Date.now()}`,
        description: novelDescription.trim() || null,
        cover_path: null,
        category_id: categoryId,
        status: novelStatus,
        language: novelLanguage,
        direction: novelDirection,
        published: publish,
        created_by: user.id,
      });

      if (error) {
        setNovelMessage(error.message);
        return;
      }

      setNovelTitle("");
      setNovelDescription("");
      setNovelCategory("");
      setNovelStatus("ongoing");
      setNovelLanguage("العربية");
      setNovelDirection("rtl");
      setShowNovelForm(false);

      setNovelMessage(
        publish
          ? "تم حفظ الرواية ونشرها بنجاح."
          : "تم حفظ الرواية كمسودة. لن تظهر للقراء."
      );

      await loadAdminData();
      await loadPublishedNovels();
    } finally {
      setSavingNovel(false);
    }
  }

  async function toggleNovelPublished(novel: Novel) {
    if (!canManageNovels) {
      setNovelMessage("ليس لديك صلاحية لتغيير حالة الرواية.");
      return;
    }

    const nextPublished = !novel.published;

    const { error } = await supabase
      .from("novels")
      .update({
        published: nextPublished,
      })
      .eq("id", novel.id);

    if (error) {
      setNovelMessage(error.message);
      return;
    }

    setNovels((current) =>
      current.map((item) =>
        item.id === novel.id
          ? { ...item, published: nextPublished }
          : item
      )
    );

    setPublishedNovels((current) => {
      if (nextPublished) {
        return current.some((item) => item.id === novel.id)
          ? current
          : [...current, { ...novel, published: true }];
      }

      return current.filter((item) => item.id !== novel.id);
    });

    setNovelMessage(
      nextPublished
        ? `تم نشر «${novel.title}».`
        : `تم إلغاء نشر «${novel.title}» وحفظها كمسودة.`
    );

    await loadPublishedNovels();
  }

  async function deleteNovel(novel: Novel) {
    if (!isOwner) {
      setNovelMessage("حذف الروايات متاح للمالك فقط.");
      return;
    }

    const confirmed = window.confirm(
      `هل أنت متأكدة من حذف رواية «${novel.title}»؟\n\nهذا الحذف للرواية نفسها.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("novels")
      .delete()
      .eq("id", novel.id);

    if (error) {
      setNovelMessage(error.message);
      return;
    }

    setNovels((current) =>
      current.filter((item) => item.id !== novel.id)
    );

    setPublishedNovels((current) =>
      current.filter((item) => item.id !== novel.id)
    );

    if (selectedNovel?.id === novel.id) {
      setSelectedNovel(null);
    }

    setNovelMessage("تم حذف الرواية.");
  }

  async function addStaff() {
    if (!isOwner) return;

    if (!staffEmail.trim()) {
      setStaffMessage("اكتبي بريد المشرف.");
      return;
    }

    setManagingStaff(true);
    setStaffMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "manage-staff",
        {
          body: {
            action: "set_role",
            email: staffEmail.trim(),
            role: "staff",
          },
        }
      );

      if (error) {
        setStaffMessage(error.message);
        return;
      }

      if (data?.error) {
        setStaffMessage(data.error);
        return;
      }

      setStaffEmail("");
      setStaffMessage("تمت إضافة المشرف بنجاح.");
      await loadStaffMembers();
    } finally {
      setManagingStaff(false);
    }
  }

  async function removeStaff(staff: StaffMember) {
    if (!isOwner) return;

    const confirmed = window.confirm(
      `هل تريدين إزالة صلاحية المشرف من ${
        staff.display_name || "هذا المستخدم"
      }؟`
    );

    if (!confirmed) return;

    setManagingStaff(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "manage-staff",
        {
          body: {
            action: "set_role",
            email: staff.email,
            role: "reader",
          },
        }
      );

      if (error) {
        setStaffMessage(error.message);
        return;
      }

      if (data?.error) {
        setStaffMessage(data.error);
        return;
      }

      setStaffMessage("تمت إزالة صلاحية المشرف.");
      await loadStaffMembers();
    } finally {
      setManagingStaff(false);
    }
  }

  async function loginWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  }

  async function logout() {
    await supabase.auth.signOut();

    setUser(null);
    setProfile(null);
    setShowAccount(false);
    setShowAdmin(false);
    setSelectedNovel(null);
  }

  async function markNotificationRead(id: string) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, read: true }
          : notification
      )
    );
  }

  function openNovel(novel: Novel) {
    setSelectedNovel(novel);
    setShowNovels(false);
  }

  function backToNovels() {
    setSelectedNovel(null);
    setShowNovels(true);
  }

  const unreadNotifications = notifications.filter(
    (notification) => !notification.read
  ).length;

  return (
    <div
      dir="rtl"
      className="app"
    >
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => {
              setShowAccount(false);
              setShowAdmin(false);
              setSelectedNovel(null);
              setShowNovels(true);
            }}
          >
            <strong>روايات خيالية</strong>
            <span>عالم من الحكايات</span>
          </button>

          <nav className="main-nav">
            <button
              className={showNovels ? "active" : ""}
              onClick={() => {
                setShowNovels(true);
                setShowAccount(false);
                setShowAdmin(false);
                setSelectedNovel(null);
              }}
            >
              الروايات
            </button>

            {user && (
              <button
                className={showAccount ? "active" : ""}
                onClick={() => {
                  setShowAccount(true);
                  setShowAdmin(false);
                  setShowNovels(false);
                  setSelectedNovel(null);
                }}
              >
                حسابي
                {unreadNotifications > 0 && (
                  <span className="notification-badge">
                    {unreadNotifications}
                  </span>
                )}
              </button>
            )}

            {canManageNovels && (
              <button
                className={showAdmin ? "active" : ""}
                onClick={() => {
                  setShowAdmin(true);
                  setShowAccount(false);
                  setShowNovels(false);
                  setSelectedNovel(null);
                }}
              >
                الإدارة
              </button>
            )}
          </nav>

          <div className="header-actions">
            {user ? (
              <button
                className="account-button"
                onClick={() => {
                  setShowAccount(true);
                  setShowAdmin(false);
                  setShowNovels(false);
                }}
              >
                {profile?.display_name ||
                  user.email ||
                  "حسابي"}
              </button>
            ) : (
              <button
                className="account-button"
                onClick={loginWithGoogle}
              >
                تسجيل الدخول
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        {selectedNovel ? (
          <section className="novel-reader">
            <button
              className="back-button"
              onClick={backToNovels}
            >
              ← العودة للروايات
            </button>

            <div className="novel-detail">
              <div className="novel-cover-large">
                {selectedNovel.cover_path ? (
                  <img
                    src={selectedNovel.cover_path}
                    alt={selectedNovel.title}
                  />
                ) : (
                  <div className="cover-placeholder">
                    📖
                  </div>
                )}
              </div>

              <div className="novel-detail-content">
                <span className="novel-category">
                  {selectedNovel.categories?.name ||
                    "رواية"}
                </span>

                <h1>{selectedNovel.title}</h1>

                <p>
                  {selectedNovel.description ||
                    "لا يوجد وصف لهذه الرواية حاليًا."}
                </p>

                <div className="novel-meta">
                  <span>
                    {selectedNovel.status === "completed"
                      ? "مكتملة"
                      : "مستمرة"}
                  </span>
                  <span>{selectedNovel.language}</span>
                </div>

                <button className="primary-button">
                  بدء القراءة
                </button>
              </div>
            </div>
          </section>
        ) : showAdmin && canManageNovels ? (
          <section className="account-page">
            <div className="page-heading">
              <span>لوحة الإدارة</span>
              <h1>إدارة الروايات</h1>
              <p>
                هنا يمكنك حفظ الروايات كمسودات ثم نشرها
                عندما تصبح جاهزة.
              </p>
            </div>

            <div className="account-card">
              <div className="admin-heading-row">
                <div>
                  <h2>الروايات</h2>
                  <p>
                    المسودة لا تظهر للقراء حتى يتم نشرها.
                  </p>
                </div>

                <button
                  className="primary-button"
                  onClick={() => {
                    setShowNovelForm((value) => !value);
                    setNovelMessage("");
                  }}
                >
                  {showNovelForm
                    ? "إلغاء"
                    : "+ إضافة رواية"}
                </button>
              </div>

              {showNovelForm && (
                <div className="panel novel-form">
                  <h3>إضافة رواية جديدة</h3>

                  <label>
                    اسم الرواية
                    <input
                      value={novelTitle}
                      onChange={(event) =>
                        setNovelTitle(event.target.value)
                      }
                      placeholder="مثال: لعنة القلعة"
                    />
                  </label>

                  <label>
                    الوصف
                    <textarea
                      value={novelDescription}
                      onChange={(event) =>
                        setNovelDescription(
                          event.target.value
                        )
                      }
                      placeholder="اكتبي وصف الرواية..."
                    />
                  </label>

                  <label>
                    التصنيف
                    <input
                      value={novelCategory}
                      onChange={(event) =>
                        setNovelCategory(
                          event.target.value
                        )
                      }
                      placeholder="رعب، فانتازيا، رومانسية..."
                    />
                  </label>

                  <label>
                    الحالة
                    <select
                      value={novelStatus}
                      onChange={(event) =>
                        setNovelStatus(
                          event.target.value as
                            | "ongoing"
                            | "completed"
                        )
                      }
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
                    اللغة
                    <input
                      value={novelLanguage}
                      onChange={(event) =>
                        setNovelLanguage(
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    اتجاه القراءة
                    <select
                      value={novelDirection}
                      onChange={(event) =>
                        setNovelDirection(
                          event.target.value as
                            | "rtl"
                            | "ltr"
                        )
                      }
                    >
                      <option value="rtl">
                        من اليمين لليسار
                      </option>
                      <option value="ltr">
                        من اليسار لليمين
                      </option>
                    </select>
                  </label>

                  {novelMessage && (
                    <div className="panel">
                      {novelMessage}
                    </div>
                  )}

                  <div className="form-actions">
                    <button
                      className="secondary-button"
                      disabled={savingNovel}
                      onClick={() => saveNovel(false)}
                    >
                      📝 حفظ كمسودة
                    </button>

                    <button
                      className="primary-button"
                      disabled={savingNovel}
                      onClick={() => saveNovel(true)}
                    >
                      🟢 حفظ ونشر
                    </button>
                  </div>
                </div>
              )}

              {novels.length === 0 ? (
                <div className="panel">
                  لا توجد روايات حاليًا.
                </div>
              ) : (
                <div className="account-list">
                  {novels.map((novel) => (
                    <div
                      className="account-novel"
                      key={novel.id}
                    >
                      <div className="novel-list-cover">
                        {novel.cover_path ? (
                          <img
                            src={novel.cover_path}
                            alt={novel.title}
                          />
                        ) : (
                          "📖"
                        )}
                      </div>

                      <div className="novel-list-info">
                        <h3>{novel.title}</h3>

                        <span>
                          {novel.categories?.name ||
                            "بدون تصنيف"}
                        </span>

                        <small>
                          {novel.published
                            ? "🟢 منشورة"
                            : "📝 مسودة"}
                        </small>
                      </div>

                      <div className="novel-list-actions">
                        <button
                          className={
                            novel.published
                              ? "secondary-button"
                              : "primary-button"
                          }
                          onClick={() =>
                            toggleNovelPublished(novel)
                          }
                        >
                          {novel.published
                            ? "⚪ إلغاء النشر"
                            : "🟢 نشر الرواية"}
                        </button>

                        <button
                          className="secondary-button"
                          onClick={() =>
                            openNovel(novel)
                          }
                        >
                          عرض
                        </button>

                        {isOwner && (
                          <button
                            className="danger-button"
                            onClick={() =>
                              deleteNovel(novel)
                            }
                          >
                            حذف
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isOwner && (
              <div className="account-card">
                <h2>👥 إدارة المشرفين</h2>

                <div className="panel">
                  <label>
                    بريد المستخدم
                    <input
                      type="email"
                      value={staffEmail}
                      onChange={(event) =>
                        setStaffEmail(event.target.value)
                      }
                      placeholder="example@email.com"
                    />
                  </label>

                  <button
                    className="primary-button"
                    disabled={managingStaff}
                    onClick={addStaff}
                  >
                    إضافة كمشرف
                  </button>

                  {staffMessage && (
                    <div
                      className="panel"
                      style={{
                        marginTop: "15px",
                        lineHeight: "1.8",
                      }}
                    >
                      {staffMessage}
                    </div>
                  )}
                </div>

                <div
                  className="account-card"
                  style={{
                    marginTop: "15px",
                  }}
                >
                  <h3>👥 المشرفون الحاليون</h3>

                  {loadingStaff ? (
                    <div className="account-loading">
                      جارٍ تحميل المشرفين...
                    </div>
                  ) : staffMembers.length === 0 ? (
                    <div className="panel">
                      لا يوجد مشرفون حاليًا.
                    </div>
                  ) : (
                    <div className="account-list">
                      {staffMembers.map((staff) => (
                        <div
                          className="account-novel"
                          key={staff.id}
                        >
                          <div className="avatar">
                            {(staff.display_name ||
                              "م")[0]}
                          </div>

                          <div className="novel-list-info">
                            <h3>
                              {staff.display_name ||
                                "مشرف"}
                            </h3>

                            <span>
                              {staff.email ||
                                "بريد غير متوفر"}
                            </span>

                            <small>
                              صلاحية: مشرف
                            </small>
                          </div>

                          <button
                            className="danger-button"
                            disabled={managingStaff}
                            onClick={() =>
                              removeStaff(staff)
                            }
                          >
                            إزالة الصلاحية
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        ) : showAccount && user ? (
          <section className="account-page">
            <div className="page-heading">
              <span>حسابك</span>
              <h1>
                مرحبًا{" "}
                {profile?.display_name ||
                  user.email?.split("@")[0] ||
                  ""}
              </h1>
            </div>

            <div className="account-layout">
              <aside className="account-sidebar">
                <button
                  className={
                    activeSection === "profile"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveSection("profile")
                  }
                >
                  الملف الشخصي
                </button>

                <button
                  className={
                    activeSection === "favorites"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveSection("favorites")
                  }
                >
                  المفضلة
                </button>

                <button
                  className={
                    activeSection === "history"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveSection("history")
                  }
                >
                  سجل القراءة
                </button>

                <button
                  className={
                    activeSection === "notifications"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveSection("notifications")
                  }
                >
                  الإشعارات
                  {unreadNotifications > 0 && (
                    <span className="notification-badge">
                      {unreadNotifications}
                    </span>
                  )}
                </button>

                <button onClick={logout}>
                  تسجيل الخروج
                </button>
              </aside>

              <div className="account-content">
                {loadingAccountData ? (
                  <div className="account-loading">
                    جارٍ تحميل الحساب...
                  </div>
                ) : (
                  <>
                    {activeSection === "profile" && (
                      <div className="account-card">
                        <h2>الملف الشخصي</h2>

                        <div className="profile-header">
                          <div className="profile-avatar">
                            {profile?.avatar_url ? (
                              <img
                                src={profile.avatar_url}
                                alt=""
                              />
                            ) : (
                              (
                                profile?.display_name ||
                                user.email ||
                                "م"
                              )[0]
                            )}
                          </div>

                          <div>
                            <h3>
                              {profile?.display_name ||
                                "قارئ"}
                            </h3>

                            <p>{user.email}</p>

                            <small>
                              الصلاحية:{" "}
                              {profile?.role ===
                              "owner"
                                ? "المالك"
                                : profile?.role ===
                                  "staff"
                                ? "مشرف"
                                : "قارئ"}
                            </small>
                          </div>
                        </div>

                        {profile?.bio && (
                          <p>{profile.bio}</p>
                        )}
                      </div>
                    )}

                    {activeSection === "favorites" && (
                      <div className="account-card">
                        <h2>المفضلة</h2>

                        {favorites.length === 0 ? (
                          <div className="panel">
                            لا توجد روايات في المفضلة
                            حاليًا.
                          </div>
                        ) : (
                          <div className="account-list">
                            {favorites.map((item) => (
                              <div
                                className="account-novel"
                                key={item.id}
                              >
                                <span>
                                  رواية مفضلة
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {activeSection === "history" && (
                      <div className="account-card">
                        <h2>سجل القراءة</h2>

                        {history.length === 0 ? (
                          <div className="panel">
                            لم تبدأ قراءة أي رواية
                            بعد.
                          </div>
                        ) : (
                          <div className="account-list">
                            {history.map((item) => (
                              <div
                                className="account-novel"
                                key={item.id}
                              >
                                <span>
                                  سجل قراءة
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {activeSection ===
                      "notifications" && (
                      <div className="account-card">
                        <h2>الإشعارات</h2>

                        {notifications.length ===
                        0 ? (
                          <div className="panel">
                            لا توجد إشعارات.
                          </div>
                        ) : (
                          <div className="account-list">
                            {notifications.map(
                              (notification) => (
                                <button
                                  className="account-novel"
                                  key={notification.id}
                                  onClick={() =>
                                    markNotificationRead(
                                      notification.id
                                    )
                                  }
                                >
                                  <div>
                                    <strong>
                                      {notification.title ||
                                        "إشعار"}
                                    </strong>

                                    <p>
                                      {
                                        notification.message
                                      }
                                    </p>
                                  </div>

                                  {!notification.read && (
                                    <span className="notification-badge">
                                      جديد
                                    </span>
                                  )}
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="novels-page">
            <div className="hero">
              <span>عالم الروايات</span>
              <h1>اقرئي حكايتك القادمة</h1>
              <p>
                اكتشفي الروايات المنشورة واقرئيها في
                مكان واحد.
              </p>
            </div>

            <div className="novels-section">
              <div className="section-heading">
                <div>
                  <span>المكتبة</span>
                  <h2>الروايات</h2>
                </div>
              </div>

              {publishedNovels.length === 0 ? (
                <div className="panel">
                  لا توجد روايات منشورة حاليًا.
                </div>
              ) : (
                <div className="novels-grid">
                  {publishedNovels.map((novel) => (
                    <article
                      className="novel-card"
                      key={novel.id}
                      onClick={() => openNovel(novel)}
                    >
                      <div className="novel-cover">
                        {novel.cover_path ? (
                          <img
                            src={novel.cover_path}
                            alt={novel.title}
                          />
                        ) : (
                          <div className="cover-placeholder">
                            📖
                          </div>
                        )}
                      </div>

                      <div className="novel-card-content">
                        <span className="novel-category">
                          {novel.categories?.name ||
                            "رواية"}
                        </span>

                        <h3>{novel.title}</h3>

                        <p>
                          {novel.description ||
                            "لا يوجد وصف حاليًا."}
                        </p>

                        <div className="novel-meta">
                          <span>
                            {novel.status ===
                            "completed"
                              ? "مكتملة"
                              : "مستمرة"}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="site-footer">
        <p>روايات خيالية © 2026</p>
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
