import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = { chapterId: string; canManage: boolean; isOwner: boolean };

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
  const [reactionName,setReactionName]=useState("");
  const [reactionFile,setReactionFile]=useState<File|null>(null);
  const [favoriteReactionIds,setFavoriteReactionIds]=useState<string[]>([]);

  async function loadAds() {
    const {data}=await supabase.from("ads").select("*").eq("enabled",true).in("status",["active","scheduled"]).order("priority",{ascending:false}).limit(20);
    setAds(data||[]);
  }
  async function loadComments(userId?:string|null) {
    const [{data:cs},{data:rs}] = await Promise.all([
      supabase.from("chapter_comments").select("id,content,author_name,created_at").eq("chapter_id",chapterId).order("created_at",{ascending:false}),
      supabase.from("reaction_types").select("id,name,icon_path,enabled,sort_order").order("sort_order")
    ]);
    const {data:fs}=userId
      ? await supabase.from("reaction_favorites").select("reaction_type_id").eq("user_id",userId)
      : {data:[]};
    setComments(cs||[]); setReactions(rs||[]); setFavoriteReactionIds((fs||[]).map((item:any)=>item.reaction_type_id));
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
    const {error}=await supabase.from("chapter_comments").insert({chapter_id:chapterId,user_id:current!.id,author_name:name,content:text});
    setBusy(false);
    if(error){setMessage(error.message);return}
    setDraft("");
    setComments(prev=>[{id:crypto.randomUUID(),content:text,author_name:name,created_at:new Date().toISOString()},...prev]);
  }

  async function toggleReaction(commentId:string,reactionId:string){
    if(!user){setMessage("سجلي الدخول للتفاعل.");return}
    const {data:existing}=await supabase.from("comment_reactions").select("comment_id").eq("comment_id",commentId).eq("reaction_type_id",reactionId).eq("user_id",user.id).maybeSingle();
    if(existing) await supabase.from("comment_reactions").delete().match({comment_id:commentId,reaction_type_id:reactionId,user_id:user.id});
    else await supabase.from("comment_reactions").insert({comment_id:commentId,reaction_type_id:reactionId,user_id:user.id});
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

  async function addReactionType(){
    if(!isOwner||!reactionName.trim())return;
    let icon_path:string|null=null;
    if(reactionFile){
      const ext=reactionFile.name.split(".").pop()||"png";
      icon_path="reactions/"+crypto.randomUUID()+"."+ext;
      const {error}=await supabase.storage.from("ad-media").upload(icon_path,reactionFile,{upsert:false});
      if(error){setMessage(error.message);return}
    }
    const {error}=await supabase.from("reaction_types").insert({name:reactionName.trim(),icon_path,sort_order:reactions.length});
    if(error)setMessage(error.message); else {setReactionName("");setReactionFile(null);await loadComments(user?.id ?? null)}
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
        <textarea value={draft} maxLength={1000} onChange={e=>setDraft(e.target.value)} placeholder={user?"اكتبي تعليقك...":"سجلي الدخول للمشاركة"} />
        <button className="primary-button" disabled={busy||!draft.trim()} onClick={()=>void addComment()}>نشر التعليق</button>
      </div>
      {message&&<div className="message-box">{message}</div>}
      {comments.length===0?<div className="empty-state">لا توجد تعليقات بعد. كوني أول من يعلّق.</div>:comments.map(c=><article className="comment-card" key={c.id}>
        <div className="comment-head"><strong>{c.author_name}</strong><time>{new Date(c.created_at).toLocaleDateString("ar-SA")}</time></div>
        <p>{c.content}</p>
        <div className="comment-reaction-groups">
          {favoriteReactionIds.length>0&&<div className="reaction-group"><span className="reaction-group-title">مفضلاتك</span><div className="comment-reactions">{reactions.filter(r=>r.enabled&&favoriteReactionIds.includes(r.id)).map(r=><div className="reaction-chip" key={"fav-"+r.id}><button className="reaction-use-button" onClick={()=>void toggleReaction(c.id,r.id)} title={"استخدام "+r.name}>{r.icon_path?<img src={mediaUrl(r.icon_path)} alt="" loading="lazy" />:r.name}</button><button className="reaction-favorite-button active" onClick={()=>void toggleFavoriteReaction(r.id)} title="إزالة من المفضلة" aria-label="إزالة من المفضلة">♥</button></div>)}</div></div>}
          <div className="reaction-group"><span className="reaction-group-title">كل الرياكشنات</span><div className="comment-reactions">{reactions.filter(r=>r.enabled).map(r=><div className="reaction-chip" key={r.id}><button className="reaction-use-button" onClick={()=>void toggleReaction(c.id,r.id)} title={"استخدام "+r.name}>{r.icon_path?<img src={mediaUrl(r.icon_path)} alt="" loading="lazy" />:r.name}</button><button className={"reaction-favorite-button"+(favoriteReactionIds.includes(r.id)?" active":"")} onClick={()=>void toggleFavoriteReaction(r.id)} title={favoriteReactionIds.includes(r.id)?"إزالة من المفضلة":"حفظ في المفضلة"} aria-label={favoriteReactionIds.includes(r.id)?"إزالة من المفضلة":"حفظ في المفضلة"}>{favoriteReactionIds.includes(r.id)?"♥":"♡"}</button></div>)}</div></div>
        </div>
      </article>)}
      {isOwner&&<div className="reaction-admin">
        <strong>إدارة الرياكشنات والستيكرات</strong><small className="form-hint">ارفعي صور رياكشناتك من الواتساب بصيغ الصور المدعومة، وسيظهر للقُرّاء زر ♥ لحفظ أي رياكشن في مفضلاتهم.</small>
        <div className="reaction-admin-row"><input value={reactionName} onChange={e=>setReactionName(e.target.value)} placeholder="اسم التفاعل" /><input type="file" accept="image/*" onChange={e=>setReactionFile(e.target.files?.[0]||null)} /><button className="secondary-button" onClick={()=>void addReactionType()}>إضافة</button></div>
        <div className="reaction-admin-list">{reactions.map((r,i)=><div className="ad-row" key={r.id}><span>{r.icon_path?<img src={mediaUrl(r.icon_path)} alt="" style={{width:24,height:24,objectFit:"contain",verticalAlign:"middle"}}/>:""} {r.name}</span><span>
          <button className="secondary-button" onClick={async()=>{await supabase.from("reaction_types").update({enabled:!r.enabled}).eq("id",r.id);await loadComments(user?.id ?? null)}}>{r.enabled?"تعطيل":"تفعيل"}</button>
          <button className="secondary-button" disabled={i===0} onClick={async()=>{if(i===0)return;const prev=reactions[i-1];await Promise.all([supabase.from("reaction_types").update({sort_order:prev.sort_order}).eq("id",r.id),supabase.from("reaction_types").update({sort_order:r.sort_order}).eq("id",prev.id)]);await loadComments(user?.id ?? null)}}>↑</button>
          <button className="secondary-button" disabled={i===reactions.length-1} onClick={async()=>{if(i===reactions.length-1)return;const next=reactions[i+1];await Promise.all([supabase.from("reaction_types").update({sort_order:next.sort_order}).eq("id",r.id),supabase.from("reaction_types").update({sort_order:r.sort_order}).eq("id",next.id)]);await loadComments(user?.id ?? null)}}>↓</button>
          <button className="danger-button" onClick={async()=>{await supabase.from("reaction_types").delete().eq("id",r.id);await loadComments(user?.id ?? null)}}>حذف</button>
        </span></div>)}</div>
      </div>}
    </section>}
  </div>
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
