import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { supabase } from "./lib/supabase";

type Role = "owner" | "staff" | "reader";

type Profile = {
  role: Role;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
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
};

type StaffMember = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
};

type AccountSection =
  | "favorites"
  | "history"
  | "notifications"
  | null;

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
  const [showNovels, setShowNovels] = useState(false);

  const [selectedNovel, setSelectedNovel] =
    useState<Novel | null>(null);

  const [activeSection, setActiveSection] =
    useState<AccountSection>(null);

  const [favorites, setFavorites] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [notifications, setNotifications] =
    useState<any[]>([]);

  const [loadingAccountData, setLoadingAccountData] =
    useState(false);

  const [novels, setNovels] = useState<Novel[]>([]);
  const [publishedNovels, setPublishedNovels] =
    useState<Novel[]>([]);

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [showNovelForm, setShowNovelForm] =
    useState(false);

  const [savingNovel, setSavingNovel] =
    useState(false);

  const [novelTitle, setNovelTitle] = useState("");
  const [novelDescription, setNovelDescription] =
    useState("");
  const [novelCategory, setNovelCategory] =
    useState("");

  const [novelStatus, setNovelStatus] =
    useState<"ongoing" | "completed">("ongoing");

  const [novelLanguage, setNovelLanguage] =
    useState("ar");

  const [novelDirection, setNovelDirection] =
    useState<"rtl" | "ltr">("rtl");

  const [novelPublished, setNovelPublished] =
    useState(false);

  const [novelMessage, setNovelMessage] =
    useState("");

  /* =========================
     إدارة المشرفين
  ========================= */

  const [staffMembers, setStaffMembers] =
    useState<StaffMember[]>([]);

  const [loadingStaff, setLoadingStaff] =
    useState(false);

  const [staffEmail, setStaffEmail] =
    useState("");

  const [staffMessage, setStaffMessage] =
    useState("");

  const [managingStaff, setManagingStaff] =
    useState(false);

  /* =========================
     البداية والجلسة
  ========================= */

  useEffect(() => {
    loadSession();
    loadPublishedNovels();

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
    if (
      showAdmin &&
      (profile?.role === "owner" ||
        profile?.role === "staff")
    ) {
      loadAdminData();
    }
  }, [showAdmin, profile]);

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

  async function loadPublishedNovels() {
    const { data, error } = await supabase
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
      .eq("published", true)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Published novels:",
        error
      );
      return;
    }

    setPublishedNovels(data || []);
  }

  async function loadAdminData() {
    const [
      novelsResult,
      categoriesResult,
    ] = await Promise.all([
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

    if (profile?.role === "owner") {
      loadStaffMembers();
    }
  }

  /* =========================
     المشرفون
  ========================= */

  async function loadStaffMembers() {
    if (!user || profile?.role !== "owner") {
      return;
    }

    setLoadingStaff(true);
    setStaffMessage("");

    const { data, error } =
      await supabase.functions.invoke(
        "manage-staff",
        {
          body: {
            action: "list",
          },
        }
      );

    if (error) {
      console.error(
        "Staff list:",
        error
      );

      setStaffMessage(
        "تعذر تحميل قائمة المشرفين."
      );

      setLoadingStaff(false);
      return;
    }

    if (data?.error) {
      setStaffMessage(data.error);
      setLoadingStaff(false);
      return;
    }

    setStaffMembers(
      data?.staff || []
    );

    setLoadingStaff(false);
  }

  async function addStaff() {
    if (
      !user ||
      profile?.role !== "owner"
    ) {
      return;
    }

    const email =
      staffEmail.trim().toLowerCase();

    if (!email) {
      setStaffMessage(
        "اكتبي البريد الإلكتروني للحساب."
      );
      return;
    }

    setManagingStaff(true);
    setStaffMessage("");

    const { data, error } =
      await supabase.functions.invoke(
        "manage-staff",
        {
          body: {
            action: "set_role",
            email,
            role: "staff",
          },
        }
      );

    if (error) {
      console.error(
        "Add staff:",
        error
      );

      setStaffMessage(
        "حدث خطأ أثناء إضافة المشرف."
      );

      setManagingStaff(false);
      return;
    }

    if (data?.error) {
      setStaffMessage(data.error);
      setManagingStaff(false);
      return;
    }

    setStaffEmail("");

    setStaffMessage(
      "✅ تمت إضافة المشرف بنجاح. يجب على الحساب تسجيل الخروج ثم الدخول مرة أخرى لتفعيل الصلاحية."
    );

    await loadStaffMembers();

    setManagingStaff(false);
  }

  async function removeStaff(
    staff: StaffMember
  ) {
    if (
      !user ||
      profile?.role !== "owner"
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `هل تريدين إعادة حساب "${staff.email}" إلى قارئ؟`
      );

    if (!confirmed) {
      return;
    }

    setManagingStaff(true);
    setStaffMessage("");

    const { data, error } =
      await supabase.functions.invoke(
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
      console.error(
        "Remove staff:",
        error
      );

      setStaffMessage(
        "حدث خطأ أثناء إزالة صلاحية المشرف."
      );

      setManagingStaff(false);
      return;
    }

    if (data?.error) {
      setStaffMessage(data.error);
      setManagingStaff(false);
      return;
    }

    setStaffMessage(
      "✅ تمت إعادة الحساب إلى قارئ."
    );

    await loadStaffMembers();

    setManagingStaff(false);
  }

  /* =========================
     بيانات الحساب
  ========================= */

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

  /* =========================
     إضافة رواية
  ========================= */

  async function saveNovel() {
    if (!user) return;

    if (
      profile?.role !== "owner" &&
      profile?.role !== "staff"
    ) {
      return;
    }

    setNovelMessage("");

    const title =
      novelTitle.trim();

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

    const slug =
      makeSlug(title);

    if (!slug) {
      setNovelMessage(
        "تعذر إنشاء رابط للرواية."
      );
      return;
    }

    setSavingNovel(true);

    try {
      let categoryId:
        | string
        | null = null;

      const existingCategory =
        categories.find(
          (category) =>
            category.name.trim() ===
            categoryName
        );

      if (existingCategory) {
        categoryId =
          existingCategory.id;
      } else {
        const categorySlug =
          makeSlug(categoryName) ||
          `category-${Date.now()}`;

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
          console.error(
            "Category:",
            categoryError
          );

          setNovelMessage(
            "حدث خطأ أثناء إنشاء التصنيف."
          );

          return;
        }

        categoryId =
          newCategory.id;

        setCategories(
          (current) => [
            ...current,
            newCategory,
          ]
        );
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
          category_id:
            categoryId,
          status:
            novelStatus,
          language:
            novelLanguage,
          direction:
            novelDirection,
          published:
            novelPublished,
          created_by:
            user.id,
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
        console.error(
          "Novel:",
          novelError
        );

        if (
          novelError.code ===
          "23505"
        ) {
          setNovelMessage(
            "يوجد بالفعل رواية تستخدم هذا الرابط."
          );
        } else {
          setNovelMessage(
            "حدث خطأ أثناء حفظ الرواية."
          );
        }

        return;
      }

      setNovels(
        (current) => [
          createdNovel,
          ...current,
        ]
      );

      setNovelTitle("");
      setNovelDescription("");
      setNovelCategory("");
      setNovelStatus("ongoing");
      setNovelLanguage("ar");
      setNovelDirection("rtl");
      setNovelPublished(false);

      await loadPublishedNovels();

      setNovelMessage(
        "✅ تم حفظ الرواية بنجاح."
      );
    } catch (error) {
      console.error(error);

      setNovelMessage(
        "حدث خطأ أثناء حفظ الرواية."
      );
    } finally {
      setSavingNovel(false);
    }
  }

  /* =========================
     حذف رواية
  ========================= */

  async function deleteNovel(
    novel: Novel
  ) {
    if (
      !user ||
      profile?.role !== "owner"
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `هل أنتِ متأكدة من حذف رواية "${novel.title}"؟\n\nهذا الإجراء لا يمكن التراجع عنه.`
      );

    if (!confirmed) {
      return;
    }

    const { error } =
      await supabase
        .from("novels")
        .delete()
        .eq("id", novel.id);

    if (error) {
      console.error(
        "Delete novel:",
        error
      );

      alert(
        "حدث خطأ أثناء حذف الرواية."
      );

      return;
    }

    setNovels(
      (current) =>
        current.filter(
          (item) =>
            item.id !== novel.id
        )
    );

    setPublishedNovels(
      (current) =>
        current.filter(
          (item) =>
            item.id !== novel.id
        )
    );

    if (
      selectedNovel?.id ===
      novel.id
    ) {
      setSelectedNovel(null);
    }

    alert(
      "تم حذف الرواية."
    );
  }

  /* =========================
     Google
  ========================= */

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
    setShowNovels(false);
    setSelectedNovel(null);
    setActiveSection(null);
  }

  /* =========================
     الإشعارات
  ========================= */

  async function markNotificationAsRead(
    id: string
  ) {
    if (!user) return;

    const now =
      new Date().toISOString();

    const { error } =
      await supabase
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

    setNotifications(
      (current) =>
        current.map(
          (notification) =>
            notification.id === id
              ? {
                  ...notification,
                  read_at: now,
                }
              : notification
        )
    );
  }

  /* =========================
     المساعدات
  ========================= */

  const userName =
    profile?.display_name ||
    user?.user_metadata
      ?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "حسابي";

  const userAvatar =
    profile?.avatar_url ||
    user?.user_metadata
      ?.avatar_url ||
    user?.user_metadata?.picture ||
    null;

  const isOwner =
    profile?.role === "owner";

  const isStaff =
    profile?.role === "staff";

  const admin =
    isOwner || isStaff;

  const unreadNotifications =
    notifications.filter(
      (notification) =>
        !notification.read_at
    ).length;

  function formatDate(
    date: string
  ) {
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
    setActiveSection(
      (current) =>
        current === section
          ? null
          : section
    );
  }

  function goHome() {
    setShowAccount(false);
    setShowAdmin(false);
    setShowNovels(false);
    setSelectedNovel(null);
    setActiveSection(null);
  }

  function openNovels() {
    setShowAccount(false);
    setShowAdmin(false);
    setSelectedNovel(null);
    setShowNovels(true);
    setActiveSection(null);
    loadPublishedNovels();
  }

  function openNovel(
    novel: Novel
  ) {
    setShowNovels(true);
    setShowAccount(false);
    setShowAdmin(false);
    setSelectedNovel(novel);
  }

  function getCategoryName(
    categoryId: string | null
  ) {
    if (!categoryId) {
      return null;
    }

    return (
      categories.find(
        (category) =>
          category.id ===
          categoryId
      )?.name || null
    );
  }

  /* =========================
     الواجهة
  ========================= */

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
          <button onClick={goHome}>
            الرئيسية
          </button>

          <button onClick={openNovels}>
            الروايات
          </button>

          {user ? (
            <>
              {admin && (
                <button
                  onClick={() => {
                    setShowAdmin(true);
                    setShowAccount(false);
                    setShowNovels(false);
                    setSelectedNovel(null);
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
                  setShowNovels(false);
                  setSelectedNovel(null);
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
        {/* ================= الروايات ================= */}

        {showNovels ? (
          <section className="novels">
            <button
              onClick={goHome}
              style={{
                marginBottom: "25px",
              }}
            >
              ← الرئيسية
            </button>

            {selectedNovel ? (
              <div
                className="account-card"
                style={{
                  maxWidth: "850px",
                  margin: "0 auto",
                }}
              >
                <button
                  onClick={() =>
                    setSelectedNovel(null)
                  }
                >
                  ← العودة للروايات
                </button>

                <div
                  style={{
                    marginTop: "25px",
                  }}
                >
                  <div
                    className="cover"
                    style={{
                      maxWidth: "300px",
                      margin:
                        "0 auto 25px",
                    }}
                  >
                    {selectedNovel.cover_path ? (
                      <img
                        src={
                          selectedNovel.cover_path
                        }
                        alt={
                          selectedNovel.title
                        }
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius:
                            "12px",
                        }}
                      />
                    ) : (
                      "📖"
                    )}
                  </div>

                  <h2
                    style={{
                      textAlign: "center",
                    }}
                  >
                    {
                      selectedNovel.title
                    }
                  </h2>

                  {getCategoryName(
                    selectedNovel.category_id
                  ) && (
                    <div
                      style={{
                        textAlign:
                          "center",
                        marginBottom:
                          "15px",
                      }}
                    >
                      <span className="category">
                        {getCategoryName(
                          selectedNovel.category_id
                        )}
                      </span>
                    </div>
                  )}

                  <p
                    style={{
                      lineHeight: "2",
                      color: "#aaa",
                      textAlign:
                        "center",
                    }}
                  >
                    {selectedNovel.description ||
                      "لا يوجد وصف للرواية بعد."}
                  </p>

                  <div
                    className="panel"
                    style={{
                      marginTop: "25px",
                      textAlign:
                        "center",
                    }}
                  >
                    <strong>
                      {selectedNovel.status ===
                      "ongoing"
                        ? "مستمرة"
                        : "مكتملة"}
                    </strong>

                    <br />

                    <small>
                      سيتم إضافة الفصول
                      وصفحة القراءة في
                      الخطوة التالية.
                    </small>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <h2>
                  📚 الروايات
                </h2>

                {publishedNovels.length ===
                0 ? (
                  <div className="panel">
                    لا توجد روايات منشورة
                    حاليًا.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gap: "20px",
                    }}
                  >
                    {publishedNovels.map(
                      (novel) => (
                        <div
                          className="novel-card"
                          key={
                            novel.id
                          }
                          style={{
                            maxWidth:
                              "100%",
                          }}
                        >
                          <div className="cover">
                            {novel.cover_path ? (
                              <img
                                src={
                                  novel.cover_path
                                }
                                alt={
                                  novel.title
                                }
                                style={{
                                  width:
                                    "100%",
                                  height:
                                    "100%",
                                  objectFit:
                                    "cover",
                                  borderRadius:
                                    "12px",
                                }}
                              />
                            ) : (
                              "📖"
                            )}
                          </div>

                          <div>
                            {getCategoryName(
                              novel.category_id
                            ) && (
                              <span className="category">
                                {getCategoryName(
                                  novel.category_id
                                )}
                              </span>
                            )}

                            <h3>
                              {
                                novel.title
                              }
                            </h3>

                            <p>
                              {novel.description ||
                                "لا يوجد وصف للرواية بعد."}
                            </p>

                            <small
                              style={{
                                display:
                                  "block",
                                marginBottom:
                                  "15px",
                                color:
                                  "#888",
                              }}
                            >
                              {novel.status ===
                              "ongoing"
                                ? "مستمرة"
                                : "مكتملة"}
                            </small>

                            <button
                              onClick={() =>
                                openNovel(
                                  novel
                                )
                              }
                            >
                              قراءة الرواية
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </>
            )}
          </section>

        /* ================= لوحة الإدارة ================= */

        ) : showAdmin &&
          user &&
          admin ? (
          <section className="account-page">
            <button
              onClick={() =>
                setShowAdmin(false)
              }
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

              {/* ================= إدارة المشرفين ================= */}

              {isOwner && (
                <div className="account-section">
                  <div className="section-heading">
                    <h2>
                      🛡️ إدارة المشرفين
                    </h2>

                    <span>
                      {staffMembers.length}
                    </span>
                  </div>

                  <div
                    className="account-card"
                    style={{
                      marginTop: "15px",
                    }}
                  >
                    <h3>
                      ➕ إضافة مشرف
                    </h3>

                    <p className="account-muted">
                      اكتبي البريد الإلكتروني
                      لحساب موجود بالفعل في
                      الموقع.
                    </p>

                    <div
                      style={{
                        display: "grid",
                        gap: "12px",
                      }}
                    >
                      <input
                        type="email"
                        value={staffEmail}
                        onChange={(e) =>
                          setStaffEmail(
                            e.target.value
                          )
                        }
                        placeholder="example@gmail.com"
                        style={{
                          width: "100%",
                          padding: "12px",
                          borderRadius:
                            "8px",
                          border:
                            "1px solid #444",
                          background:
                            "#111",
                          color: "#fff",
                          fontFamily:
                            "inherit",
                          direction:
                            "ltr",
                          textAlign:
                            "left",
                        }}
                      />

                      <button
                        className="main-button"
                        disabled={
                          managingStaff
                        }
                        onClick={
                          addStaff
                        }
                      >
                        {managingStaff
                          ? "جارٍ التنفيذ..."
                          : "🛡️ إضافة كمشرف"}
                      </button>
                    </div>

                    {staffMessage && (
                      <div
                        className="panel"
                        style={{
                          marginTop:
                            "15px",
                          lineHeight:
                            "1.8",
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
                    <h3>
                      👥 المشرفون الحاليون
                    </h3>

                    {loadingStaff ? (
                      <div className="account-loading">
                        جارٍ تحميل المشرفين...
                      </div>
                    ) : staffMembers.length ===
                      0 ? (
                      <div className="panel">
                        لا يوجد مشرفون حاليًا.
                      </div>
                    ) : (
                      <div className="account-list">
                        {staffMembers.map(
                          (staff) => (
                            <div
                              className="account-novel"
                              key={
                                staff.id
                              }
                              style={{
                                gridTemplateColumns:
                                  "70px
