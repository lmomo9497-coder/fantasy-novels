import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = { chapterId: string; isOwner: boolean };

type Ad = {
  id: string; internal_name: string; ad_type: "image"|"native"; status: string;
  image_path: string|null; mobile_image_path: string|null; destination_url: string|null;
  alt_text: string|null; title: string|null; cta_text: string|null;
  start_at: string|null; end_at: string|null; device_target: string;
  priority: number; frequency_cap: number; enabled: boolean;
};

type Reaction = { id:string; name:string; icon_path:string|null; enabled:boolean; sort_order:number };

function mediaUrl(path:string|null) {
  return path ? supabase.storage.from("ad-media").getPublicUrl(path).data.publicUrl : "";
}

export function ChapterExtras({chapterId, canManage, isOwner}:Props) {
  const [open,setOpen]=useState(false);
  const [comments,setComments]=useState<any[]>([]);
  const [reactions,setReactions]=useState<Reaction[]>([]);
  const [ads,setAds]=useState<Ad[]>([]);
  const [draft,setDraft]=useState("");
  const [user,setUser]=useState<any>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [favoriteReactionIds,setFavoriteReactionIds]=useState<string[]>([]);
  const [selectedReactionIds,setSelectedReactionIds]=useState<string[]>([]);
  const [commentReactionMap,setCommentReactionMap]=useState<Record<string,string[]>>({});
  const [replyTo,setReplyTo]=useState<string|null>(null);

  async function loadAds() {
    const {data}=await supabase.from("ads").select("*").eq("enabled",true).in("status",["active","scheduled"]).order("priority",{ascending:false}).limit(20);
    setAds(data||[]);
  }
  async function loadComments(userId?:string|null) {
    const {data:cs}=await supabase.from("chapter_comments").select("id,content,author_name,created_at,parent_comment_id").eq("chapter_id",chapterId).order("created_at",{ascending:false});
    const commentIds=(cs||[]).map((item:any)=>item.id);
    const [{data:rs},{data:crs},{data:fs}] = await Promise.all([
      supabase.from("reaction_types").select("id,name,icon_path,enabled,sort_order").order("sort_order"),
      commentIds.length ? supabase.from("comment_reactions").select("comment_id,reaction_type_id,reaction_types(id,name,icon_path)").in("comment_id",commentIds) : Promise.resolve({data:[]}),
      userId ? supabase.from("reaction_favorites").select("reaction_type_id").eq("user_id",userId) : Promise.resolve({data:[]})
    ]);
    const grouped:Record<string,string[]>={};
    (crs||[]).forEach((item:any)=>{
      if(!grouped[item.comment_id]) grouped[item.comment_id]=[];
      if(!grouped[item.comment_id].includes(item.reaction_type_id)) grouped[item.comment_id].push(item.reaction_type_id);
    });
    setComments(cs||[]); setReactions(rs||[]); setFavoriteReactionIds((fs||[]).map((item:any)=>item.reaction_type_id)); setCommentReactionMap(grouped);
  }
  async function openComments() {
    if(open){setOpen(false);return}
    setOpen(true);
    const {data:{user:current}}=await supabase.auth.getUser();
    setUser(current);
    await loadComments(current?.id ?? null);
  }
  useEffect(()=>{void loadAds()},[chapterId]);

  const ad = useMemo(()=>{
    const mobile=window.matchMedia?.("(max-width: 700px)").matches ?? false;
    const now=Date.now();
    return ads.find(a=>{
      if(a.device_target==="mobile"&&!mobile) return false;
      if(a.device_target==="desktop"&&mobile) return false;
      if(a.start_at&&new Date(a.start_at).getTime()>now) return false;
      if(a.end_at&&new Date(a.end_at).getTime()<now) return false;
      if(a.frequency_cap>0){
        const key="fantasy-ad-"+a.id;
        const count=Number(sessionStorage.getItem(key)||"0");
        if(count>=a.frequency_cap) return false;
      }
      return true;
    })||null;
  },[ads]);

  useEffect(()=>{
    if(!ad)return;
    const key="fantasy-ad-"+ad.id;
    sessionStorage.setItem(key,String(Number(sessionStorage.getItem(key)||"0")+1));
  },[ad?.id]);

  async function addComment(){
    const text=draft.trim();
    if(!user){setMessage("سجلي الدخول أولًا لإضافة تعليق.");return}
    if(!text)return;
    setBusy(true); setMessage("");
    const {data:{user:current}}=await supabase.auth.getUser();
    const name=(current?.user_metadata?.display_name||current?.email?.split("@")[0]||"قارئ").slice(0,80);
    const {data:created,error}=await supabase.from("chapter_comments").insert({chapter_id:chapterId,user_id:current!.id,author_name:name,content:text,parent_comment_id:replyTo}).select("id").single();
    if(error||!created){
      setBusy(false);
      setMessage(error?.message||"تعذر نشر التعليق.");
      return;
    }
    if(selectedReactionIds.length){
      const {error:reactionError}=await supabase.from("comment_reactions").insert(
        selectedReactionIds.map(reactionId=>({comment_id:created.id,user_id:current!.id,reaction_type_id:reactionId}))
      );
      if(reactionError){
        setMessage("تم نشر التعليق، لكن تعذر إرفاق بعض الرياكشنات.");
      }
    }
    setBusy(false);
    setDraft("");
    setSelectedReactionIds([]);
    setReplyTo(null);
    await loadComments(current!.id);
  }

  function toggleDraftReaction(reactionId:string){
    setSelectedReactionIds(prev=>prev.includes(reactionId)?prev.filter(id=>id!==reactionId):[...prev,reactionId]);
  }

  async function toggleReaction(commentId:string,reactionId:string){
    if(!user){setMessage("سجلي الدخول للتفاعل.");return}
    const {data:existing}=await supabase.from("comment_reactions").select("comment_id").eq("comment_id",commentId).eq("reaction_type_id",reactionId).eq("user_id",user.id).maybeSingle();
    if(existing) await supabase.from("comment_reactions").delete().match({comment_id:commentId,reaction_type_id:reactionId,user_id:user.id});
    else await supabase.from("comment_reactions").insert({comment_id:commentId,user_id:user.id,reaction_type_id:reactionId});
    await loadComments(user.id);
  }

  async function toggleFavoriteReaction(reactionId:string){
    if(!user){setMessage("سجلي الدخول لحفظ الرياكشنات المفضلة.");return}
    const isFavorite=favoriteReactionIds.includes(reactionId);
    const {error}=isFavorite
      ? await supabase.from("reaction_favorites").delete().match({user_id:user.id,reaction_type_id:reactionId})
      : await supabase.from("reaction_favorites").insert({user_id:user.id,reaction_type_id:reactionId});
    if(error){setMessage(error.message);return}
    setFavoriteReactionIds(prev=>isFavorite?prev.filter(id=>id!==reactionId):[...prev,reactionId]);
  }

  return <div className="chapter-extras">
    {ad && <div className="chapter-ad-slot" aria-label="إعلان">
      <span className="ad-label">إعلان</span>
      <a href={ad.destination_url||"#"} target={ad.destination_url?"_blank":undefined} rel="noopener noreferrer nofollow sponsored" onClick={e=>{if(!ad.destination_url)e.preventDefault()}}>
        <picture>{ad.mobile_image_path&&<source media="(max-width: 700px)" srcSet={mediaUrl(ad.mobile_image_path)}/>}
          {ad.image_path&&<img src={mediaUrl(ad.image_path)} alt={ad.alt_text||ad.internal_name} loading="lazy" decoding="async" />}
        </picture>
        {ad.ad_type==="native"&&<div className="ad-native-copy"><strong>{ad.title||ad.internal_name}</strong>{ad.cta_text&&<span>{ad.cta_text}</span>}</div>}
      </a>
    </div>}

    <button className="comments-toggle" onClick={()=>void openComments()} aria-expanded={open}>
      <span>التعليقات ({comments.length})</span><span>{open?"▲":"▼"}</span>
    </button>

    {open && <section className="comments-panel">
      <div className="comment-form">
        {replyTo&&<div className="replying-to">الرد على تعليق <button type="button" onClick={()=>setReplyTo(null)}>إلغاء</button></div>}
        <textarea value={draft} maxLength={1000} onChange={e=>setDraft(e.target.value)} placeholder={user?"اكتبي تعليقك...":"سجلي الدخول للمشاركة"} />
        {user && (
          <div className="comment-reaction-picker">
            <div className="comment-reaction-picker-head">
              <span>رياكشن مع التعليق</span>
              {selectedReactionIds.length>0 && <button type="button" className="clear-reaction-selection" onClick={()=>setSelectedReactionIds([])}>إلغاء الاختيار</button>}
            </div>
            {reactions.some(r=>r.enabled) ? (
              <div className="comment-reactions reaction-picker-list">
                {reactions.filter(r=>r.enabled).map(r=>(
                  <div className={"reaction-chip"+(selectedReactionIds.includes(r.id)?" selected":"")} key={"composer-"+r.id}>
                    <button type="button" className="reaction-use-button" onClick={()=>toggleDraftReaction(r.id)} title={"إضافة "+r.name} aria-pressed={selectedReactionIds.includes(r.id)}>
                      {r.icon_path?<img src={mediaUrl(r.icon_path)} alt={r.name} loading="lazy" />:r.name}
                    </button>
                    <button
                      type="button"
                      className={"reaction-favorite-button"+(favoriteReactionIds.includes(r.id)?" active":"")}
                      onClick={()=>void toggleFavoriteReaction(r.id)}
                      title={favoriteReactionIds.includes(r.id)?"إزالة من المفضلة":"حفظ في المفضلة"}
                      aria-label={favoriteReactionIds.includes(r.id)?"إزالة من المفضلة":"حفظ في المفضلة"}
                    >
                      {favoriteReactionIds.includes(r.id)?"♥":"♡"}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <span className="reaction-picker-empty">لا توجد رياكشنات مفعلة حاليًا.</span>
            )}
          </div>
        )}
        <button className="primary-button" disabled={busy||!draft.trim()} onClick={()=>void addComment()}>نشر التعليق</button>
      </div>
      {message&&<div className="message-box">{message}</div>}
      {comments.length===0?<div className="empty-state">لا توجد تعليقات بعد. كوني أول من يعلّق.</div>:comments.filter(c=>!c.parent_comment_id).map(c=><React.Fragment key={c.id}>
        <article className="comment-card">
          <div className="comment-head"><strong>{c.author_name}</strong><time>{new Date(c.created_at).toLocaleDateString("ar-SA")}</time></div>
          <p>{c.content}</p>
          {commentReactionMap[c.id]?.length>0&&(
            <div className="comment-attached-reactions" aria-label="الرياكشنات على التعليق">
              {commentReactionMap[c.id].map(reactionId=>{
                const r=reactions.find(item=>item.id===reactionId);
                if(!r)return null;
                return <button type="button" className="attached-reaction" key={reactionId} onClick={()=>void toggleReaction(c.id,reactionId)} title={r.name}>
                  {r.icon_path?<img src={mediaUrl(r.icon_path)} alt={r.name} loading="lazy" />:<span>{r.name}</span>}
                </button>;
              })}
            </div>
          )}
          <button type="button" className="comment-reply-button" onClick={()=>{setReplyTo(c.id);setMessage("");}}>↩ رد</button>
        </article>
        {comments.filter(reply=>reply.parent_comment_id===c.id).map(reply=><article className="comment-card comment-reply" key={reply.id}>
          <div className="comment-head"><strong>{reply.author_name}</strong><time>{new Date(reply.created_at).toLocaleDateString("ar-SA")}</time></div>
          <p>{reply.content}</p>
          {commentReactionMap[reply.id]?.length>0&&(
            <div className="comment-attached-reactions" aria-label="الرياكشنات على الرد">
              {commentReactionMap[reply.id].map(reactionId=>{
                const r=reactions.find(item=>item.id===reactionId);
                if(!r)return null;
                return <button type="button" className="attached-reaction" key={reactionId} onClick={()=>void toggleReaction(reply.id,reactionId)} title={r.name}>
                  {r.icon_path?<img src={mediaUrl(r.icon_path)} alt={r.name} loading="lazy" />:<span>{r.name}</span>}
                </button>;
              })}
            </div>
          )}
        </article>)}
      </React.Fragment>)}

    </section>}
  </div>
}

export function ReactionAdmin({canManage}:{canManage:boolean}) {
  const [reactions,setReactions]=useState<Reaction[]>([]);
  const [reactionName,setReactionName]=useState("");
  const [reactionFile,setReactionFile]=useState<File|null>(null);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const reactionFileInputRef=useRef<HTMLInputElement|null>(null);

  async function load() {
    if(!canManage)return;
    const {data,error}=await supabase.from("reaction_types").select("id,name,icon_path,enabled,sort_order").order("sort_order");
    if(error)setMessage(error.message);
    setReactions((data||[]) as Reaction[]);
  }
  useEffect(()=>{void load()},[canManage]);

  if(!canManage)return null;

  function pickFile() {
    reactionFileInputRef.current?.click();
  }

  function handleFileChange(event:React.ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0]||null;
    event.target.value="";
    if(!file)return;
    const allowedTypes=["image/png","image/jpeg","image/webp","image/gif"];
    const allowedExtensions=["png","jpg","jpeg","webp","gif"];
    const type=String(file.type||"").toLowerCase();
    const ext=(file.name.split(".").pop()||"").toLowerCase();
    if(!(allowedTypes.includes(type)||allowedExtensions.includes(ext))) {
      setReactionFile(null);
      setMessage("اختاري ملف ركشان بصيغة PNG أو JPG أو WebP أو GIF.");
      return;
    }
    if(file.size>5*1024*1024) {
      setReactionFile(null);
      setMessage("حجم الرياكشن كبير. الحد الأقصى 5MB.");
      return;
    }
    setReactionFile(file);
    setMessage("");
  }

  function resetForm() {
    setReactionName("");
    setReactionFile(null);
    setEditingId(null);
    setMessage("");
  }

  async function save() {
    const name=reactionName.trim();
    if(!name) {
      setMessage("اكتبي اسم الركشان أولًا.");
      return;
    }
    setBusy(true);
    setMessage("");
    let uploadedPath:string|null=null;
    try {
      const current=editingId ? reactions.find(r=>r.id===editingId) : null;
      let icon_path=current?.icon_path ?? null;
      if(reactionFile) {
        const ext=(reactionFile.name.split(".").pop()||"png").toLowerCase();
        uploadedPath="reactions/"+crypto.randomUUID()+"."+ext;
        const type=String(reactionFile.type||"").toLowerCase() || (ext==="gif"?"image/gif":ext==="webp"?"image/webp":"image/"+(ext==="jpg"?"jpeg":ext));
        const {error}=await supabase.storage.from("ad-media").upload(uploadedPath,reactionFile,{upsert:false,contentType:type,cacheControl:"31536000"});
        if(error)throw error;
        icon_path=uploadedPath;
      }
      const payload=editingId
        ? {name,icon_path}
        : {name,icon_path,sort_order:reactions.length};
      const result=editingId
        ? await supabase.from("reaction_types").update(payload).eq("id",editingId)
        : await supabase.from("reaction_types").insert(payload);
      if(result.error)throw result.error;

      if(editingId && reactionFile && current?.icon_path && current.icon_path!==icon_path) {
        await supabase.storage.from("ad-media").remove([current.icon_path]);
      }
      resetForm();
      await load();
      setMessage(editingId?"تم تحديث الركشان.":"تمت إضافة الركشان.");
    } catch(error:any) {
      if(uploadedPath)await supabase.storage.from("ad-media").remove([uploadedPath]);
      setMessage(error?.message||"تعذر حفظ الركشان.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(reaction:Reaction) {
    setBusy(true);
    const {error}=await supabase.from("reaction_types").update({enabled:!reaction.enabled}).eq("id",reaction.id);
    if(error)setMessage(error.message); else await load();
    setBusy(false);
  }

  async function move(reaction:Reaction,direction:-1|1) {
    const index=reactions.findIndex(r=>r.id===reaction.id);
    const other=reactions[index+direction];
    if(!other)return;
    setBusy(true);
    const {error}=await supabase.from("reaction_types").update({sort_order:other.sort_order}).eq("id",reaction.id);
    const {error:error2}=await supabase.from("reaction_types").update({sort_order:reaction.sort_order}).eq("id",other.id);
    if(error||error2)setMessage((error||error2)?.message||"تعذر ترتيب الركشانات."); else await load();
    setBusy(false);
  }

  async function remove(reaction:Reaction) {
    setBusy(true);
    const {error}=await supabase.from("reaction_types").delete().eq("id",reaction.id);
    if(error)setMessage(error.message);
    else {
      if(reaction.icon_path)await supabase.storage.from("ad-media").remove([reaction.icon_path]);
      if(editingId===reaction.id)resetForm();
      await load();
    }
    setBusy(false);
  }

  return <section className="admin-card reaction-admin">
    <div className="section-heading">
      <div>
        <span className="eyebrow">التعليقات</span>
        <h2>ركشانات التعليقات</h2>
        <p>أضيفي ركشاناتك من ملفات الجوال، بما فيها GIF المتحرك. لا يوجد رفع للقراء؛ هم يختارون فقط من الركشانات المفعلة.</p>
      </div>
      <span className="count-badge">{reactions.length}</span>
    </div>
    {message&&<div className="message-box">{message}</div>}
    <div className="reaction-admin-row">
      <input value={reactionName} onChange={e=>setReactionName(e.target.value)} placeholder="اسم الركشان" />
      <input ref={reactionFileInputRef} type="file" accept="*/*" hidden onChange={handleFileChange} />
      <button type="button" className="secondary-button" onClick={pickFile}>
        {reactionFile ? "تم اختيار الملف" : editingId ? "استبدال الملف (اختياري)" : "اختيار الركشان من الملفات"}
      </button>
      <button type="button" className="primary-button" disabled={busy} onClick={()=>void save()}>
        {busy?"جارٍ الحفظ...":editingId?"حفظ التعديل":"إضافة الركشان"}
      </button>
      {editingId&&<button type="button" className="secondary-button" disabled={busy} onClick={resetForm}>إلغاء</button>}
    </div>
    <small className="form-hint">الصيغ: PNG / JPG / WebP / GIF — الحد الأقصى 5MB. زر اختيار الملفات يستخدم مدير الملفات في أندرويد، وليس رفعًا عامًا للقراء.</small>
    <div className="reaction-admin-list">
      {reactions.length===0 ? <div className="empty-state">لا توجد ركشانات مضافة بعد.</div> :
      reactions.map((r,i)=><div className="ad-row" key={r.id}>
        <span className="reaction-admin-item">
          {r.icon_path?<img src={mediaUrl(r.icon_path)} alt="" loading="lazy" />:<span className="reaction-admin-no-image">بدون صورة</span>}
          <strong>{r.name}</strong>
          <small>{r.enabled?"مفعّل":"معطّل"}</small>
        </span>
        <span className="reaction-admin-actions">
          <button className="secondary-button" disabled={busy} onClick={()=>void toggle(r)}>{r.enabled?"تعطيل":"تفعيل"}</button>
          <button className="secondary-button" disabled={busy||i===0} onClick={()=>void move(r,-1)}>↑</button>
          <button className="secondary-button" disabled={busy||i===reactions.length-1} onClick={()=>void move(r,1)}>↓</button>
          <button className="secondary-button" disabled={busy} onClick={()=>{setEditingId(r.id);setReactionName(r.name);setReactionFile(null);setMessage("");}}>تعديل</button>
          <button className="danger-button" disabled={busy} onClick={()=>void remove(r)}>حذف</button>
        </span>
      </div>)}
    </div>
  </section>
}

export function AdsAdmin({isOwner}:{isOwner:boolean}) {
  const [ads,setAds]=useState<Ad[]>([]);
  const [form,setForm]=useState({internal_name:"",ad_type:"image",status:"draft",destination_url:"",alt_text:"",title:"",cta_text:"",device_target:"all",priority:0,frequency_cap:0,start_at:"",end_at:""});
  const [image,setImage]=useState<File|null>(null);
  const [mobile,setMobile]=useState<File|null>(null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [editingAd,setEditingAd]=useState<string|null>(null);
  async function load(){const {data}=await supabase.from("ads").select("*").order("priority",{ascending:false}).order("created_at",{ascending:false});setAds(data||[])}
  useEffect(()=>{if(isOwner)void load()},[isOwner]);
  if(!isOwner)return null;
  async function save(){
    if(!form.internal_name.trim())return;
    setBusy(true);setMessage("");
    let image_path:string|null=null,mobile_image_path:string|null=null;
    for(const [file,setter] of [[image,setImage],[mobile,setMobile]] as any){
      if(!file)continue;
      const path="ads/"+crypto.randomUUID()+"."+((file as File).name.split(".").pop()||"jpg");
      const {error}=await supabase.storage.from("ad-media").upload(path,file,{upsert:false});
      if(error){setMessage(error.message);setBusy(false);return}
      if(file===image)image_path=path; else mobile_image_path=path;
    }
    const payload={...form,priority:Number(form.priority)||0,frequency_cap:Number(form.frequency_cap)||0,start_at:form.start_at||null,end_at:form.end_at||null};
    const {error}=editingAd
      ? await supabase.from("ads").update({...payload,...(image_path?{image_path}:{ }),...(mobile_image_path?{mobile_image_path}:{ })}).eq("id",editingAd)
      : await supabase.from("ads").insert({...payload,image_path,mobile_image_path,created_by:(await supabase.auth.getUser()).data.user?.id});
    setBusy(false); if(error)setMessage(error.message); else {setForm({...form,internal_name:"",destination_url:"",alt_text:"",title:"",cta_text:"",start_at:"",end_at:""});setImage(null);setMobile(null);setEditingAd(null);setMessage("تم حفظ الإعلان.");await load()}
  }
  async function toggle(a:Ad){await supabase.from("ads").update({enabled:!a.enabled,status:a.enabled?"paused":"active"}).eq("id",a.id);await load()}
  async function remove(a:Ad){await supabase.from("ads").delete().eq("id",a.id);await load()}
  function edit(a:Ad){
    setEditingAd(a.id);
    setForm({internal_name:a.internal_name,ad_type:a.ad_type,status:a.status,destination_url:a.destination_url||"",alt_text:a.alt_text||"",title:a.title||"",cta_text:a.cta_text||"",device_target:a.device_target,priority:a.priority,frequency_cap:a.frequency_cap,start_at:a.start_at?new Date(a.start_at).toISOString().slice(0,16):"",end_at:a.end_at?new Date(a.end_at).toISOString().slice(0,16):""});
  }
  return <section className="admin-card ads-admin">
    <div className="section-heading"><div><span className="eyebrow">الإعلانات</span><h2>إدارة الإعلانات</h2><p>إعلان واحد كحد أقصى في موضع الفصل، بدون نوافذ منبثقة أو تدوير سريع.</p></div></div>
    {message&&<div className="message-box">{message}</div>}
    <div className="ad-form-grid">
      <input placeholder="اسم الإعلان الداخلي" value={form.internal_name} onChange={e=>setForm({...form,internal_name:e.target.value})}/>
      <select value={form.ad_type} onChange={e=>setForm({...form,ad_type:e.target.value})}><option value="image">صورة</option><option value="native">بطاقة داخلية</option></select>
      <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="draft">مسودة</option><option value="scheduled">مجدول</option><option value="active">نشط</option><option value="paused">متوقف</option></select>
      <select value={form.device_target} onChange={e=>setForm({...form,device_target:e.target.value})}><option value="all">كل الأجهزة</option><option value="mobile">جوال</option><option value="desktop">سطح المكتب</option></select>
      <input placeholder="رابط الوجهة (اختياري)" value={form.destination_url} onChange={e=>setForm({...form,destination_url:e.target.value})}/>
      <input placeholder="النص البديل" value={form.alt_text} onChange={e=>setForm({...form,alt_text:e.target.value})}/>
      <input placeholder="العنوان للبطاقة" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
      <input placeholder="نص الزر" value={form.cta_text} onChange={e=>setForm({...form,cta_text:e.target.value})}/>
      <label>صورة الإعلان <input type="file" accept="image/*" onChange={e=>setImage(e.target.files?.[0]||null)}/></label>
      <label>صورة الجوال <input type="file" accept="image/*" onChange={e=>setMobile(e.target.files?.[0]||null)}/></label>
      <label>الأولوية <input type="number" min="0" value={form.priority} onChange={e=>setForm({...form,priority:Number(e.target.value)})}/></label>
      <label>حد الظهور للجلسة <input type="number" min="0" value={form.frequency_cap} onChange={e=>setForm({...form,frequency_cap:Number(e.target.value)})}/></label>
      <label>بداية <input type="datetime-local" value={form.start_at} onChange={e=>setForm({...form,start_at:e.target.value})}/></label>
      <label>نهاية <input type="datetime-local" value={form.end_at} onChange={e=>setForm({...form,end_at:e.target.value})}/></label>
    </div>
    <button className="primary-button" disabled={busy} onClick={()=>void save()}>{busy?"جارٍ الحفظ...":editingAd?"حفظ التعديلات":"حفظ الإعلان"}</button>
    <div className="ad-list">{ads.map(a=><div className="ad-row" key={a.id}><div><strong>{a.internal_name}</strong><small>{a.status} · {a.device_target} · أولوية {a.priority}</small></div><div><button className="secondary-button" onClick={()=>edit(a)}>تعديل</button><button className="secondary-button" onClick={()=>void toggle(a)}>{a.enabled?"إيقاف":"تشغيل"}</button><button className="danger-button" onClick={()=>void remove(a)}>حذف</button></div></div>)}</div>
  </section>
}
