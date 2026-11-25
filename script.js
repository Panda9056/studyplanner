const STORAGE_KEY = "studysmartTasks";
const $ = (id) => document.getElementById(id);
let tasks = [];
let activeFilter = "all";
let toastTimer;

const demoTasks = [
  {id: crypto.randomUUID(), title:"Database Systems Assignment", subject:"Database Systems", due:dateOffset(2), priority:"High", status:"Pending", description:"Complete the normalisation and SQL sections."},
  {id: crypto.randomUUID(), title:"Web Development Project", subject:"Web Development", due:dateOffset(5), priority:"Medium", status:"In Progress", description:"Finish the responsive dashboard layout."},
  {id: crypto.randomUUID(), title:"Cybersecurity Quiz", subject:"Cybersecurity", due:dateOffset(8), priority:"Low", status:"Pending", description:"Revise authentication and common threats."},
  {id: crypto.randomUUID(), title:"Software Engineering Report", subject:"Software Engineering", due:dateOffset(-1), priority:"Medium", status:"Completed", description:"Review the final report before submission."}
];

function dateOffset(days) {
  const d = new Date();
  d.setHours(12,0,0,0);
  d.setDate(d.getDate()+days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return demoTasks.map(t=>({...t}));
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Could not read StudySmart tasks:", err);
    return [];
  }
}
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch (err) {
    console.error("Could not save StudySmart tasks:", err);
    showToast("Could not save data in this browser.");
    return false;
  }
}
function escapeHTML(value="") {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[ch]);
}
function fmtDate(iso) {
  if (!iso) return "No deadline";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "Invalid date";
  return d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
}
function shortDate(iso) {
  if (!iso) return {day:"—",month:""};
  const d = new Date(`${iso}T12:00:00`);
  return {day:d.toLocaleDateString("en-GB",{day:"2-digit"}),month:d.toLocaleDateString("en-GB",{month:"short"})};
}
function counts() {
  const total=tasks.length, completed=tasks.filter(t=>t.status==="Completed").length;
  const pending=tasks.filter(t=>t.status!=="Completed").length;
  return {total,completed,pending,percent:total?Math.round(completed/total*100):0};
}
function priorityRank(p){return ({High:0,Medium:1,Low:2})[p] ?? 3;}
function statusClass(s){return s.toLowerCase().replace(/\s+/g,"-");}
function showToast(message) {
  const toast=$("toast"); toast.textContent=message; toast.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove("show"),2600);
}
function navigate(view) {
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`${view}View`));
  document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  $("breadcrumbCurrent").textContent=({dashboard:"Dashboard",tasks:"My Tasks",progress:"Study Progress"})[view]||"Dashboard";
  $("sidebar").classList.remove("open");
  if(view==="tasks") renderTaskList();
  window.scrollTo({top:0,behavior:"smooth"});
}
function openModal(task=null) {
  $("taskForm").reset(); $("formError").textContent="";
  $("taskId").value=task?.id||"";
  $("modalTitle").textContent=task?"Edit task":"Add a task";
  $("taskTitle").value=task?.title||"";
  $("taskSubject").value=task?.subject||"";
  $("taskDue").value=task?.due||dateOffset(7);
  $("taskPriority").value=task?.priority||"Medium";
  $("taskStatus").value=task?.status||"Pending";
  $("taskDescription").value=task?.description||"";
  $("taskModal").hidden=false;
  setTimeout(()=>$("taskTitle").focus(),30);
}
function closeModal(){$("taskModal").hidden=true;}
function upsertTask(event) {
  event.preventDefault();
  const id=$("taskId").value;
  const title=$("taskTitle").value.trim();
  const subject=$("taskSubject").value;
  const due=$("taskDue").value;
  if(!title||!subject||!due){$("formError").textContent="Please complete the required fields.";return;}
  const record={id:id||crypto.randomUUID(),title,subject,due,priority:$("taskPriority").value,status:$("taskStatus").value,description:$("taskDescription").value.trim()};
  const index=tasks.findIndex(t=>t.id===record.id);
  if(index>=0) tasks[index]=record; else tasks.push(record);
  saveTasks(); closeModal(); renderAll(); navigate("tasks");
  showToast(index>=0?"Task updated successfully.":"Task added successfully.");
}
function changeStatus(id, checked) {
  const task=tasks.find(t=>t.id===id); if(!task)return;
  task.status=checked?"Completed":"Pending"; saveTasks(); renderAll();
  showToast(checked?"Task marked as completed.":"Task moved to pending.");
}
function editTask(id) {
  const task=tasks.find(t=>t.id===id); if(task)openModal(task);
}
function deleteTask(id) {
  const task=tasks.find(t=>t.id===id); if(!task)return;
  if(!confirm(`Delete "${task.title}"? This cannot be undone.`))return;
  tasks=tasks.filter(t=>t.id!==id); saveTasks(); renderAll(); showToast("Task deleted.");
}
function taskRow(t) {
  const done=t.status==="Completed";
  return `<article class="task-row">
    <input class="task-check" type="checkbox" aria-label="Mark ${escapeHTML(t.title)} complete" ${done?"checked":""} data-complete="${t.id}">
    <div class="task-main"><div class="task-title ${done?"done":""}">${escapeHTML(t.title)}</div>
    <div class="task-meta"><span>${escapeHTML(t.subject)}</span><span>Due ${escapeHTML(fmtDate(t.due))}</span><span class="status-badge status-${statusClass(t.status)}">${escapeHTML(t.status)}</span></div>
    ${t.description?`<div class="task-description">${escapeHTML(t.description)}</div>`:""}</div>
    <span class="priority-badge priority-${t.priority.toLowerCase()}">${escapeHTML(t.priority)} priority</span>
    <div class="row-actions"><button class="icon-button" data-edit="${t.id}" aria-label="Edit ${escapeHTML(t.title)}" title="Edit">✎</button><button class="icon-button" data-delete="${t.id}" aria-label="Delete ${escapeHTML(t.title)}" title="Delete">×</button></div>
  </article>`;
}
function emptyState(title,desc,button=false) {
  return `<div class="empty-state"><div class="empty-icon">☷</div><strong>${title}</strong><p>${desc}</p>${button?'<button class="button button-primary" data-add-task>＋ Add your first task</button>':""}</div>`;
}
function renderDashboard() {
  const c=counts();
  $("totalTasks").textContent=c.total; $("completedTasks").textContent=c.completed; $("pendingTasks").textContent=c.pending; $("progressPercent").textContent=`${c.percent}%`;
  $("circlePercent").textContent=`${c.percent}%`; $("circleCompleted").textContent=c.completed; $("circleRemaining").textContent=c.pending;
  $("dashboardCircle").style.setProperty("--progress",`${c.percent}%`);
  const upcoming=tasks.filter(t=>t.status!=="Completed").sort((a,b)=>a.due.localeCompare(b.due)).slice(0,4);
  $("upcomingList").innerHTML=upcoming.length?upcoming.map(t=>{
    const d=shortDate(t.due);
    return `<div class="upcoming-item"><div class="date-box"><strong>${escapeHTML(d.day)}</strong><span>${escapeHTML(d.month)}</span></div><div><div class="upcoming-name">${escapeHTML(t.title)}</div><div class="upcoming-sub">${escapeHTML(t.subject)} · ${escapeHTML(fmtDate(t.due))}</div></div><span class="priority-badge priority-${t.priority.toLowerCase()}">${escapeHTML(t.priority)}</span></div>`;
  }).join(""):emptyState("All caught up!","Add a task to see upcoming deadlines.",true);
  const statusData=[
    {label:"Pending",count:tasks.filter(t=>t.status==="Pending").length,color:"#e5a04d"},
    {label:"In progress",count:tasks.filter(t=>t.status==="In Progress").length,color:"#8764c6"},
    {label:"Completed",count:c.completed,color:"#199b70"}
  ];
  $("statusOverview").innerHTML=statusData.map(s=>`<div class="status-overview-card"><span>${s.label}</span><strong>${s.count}</strong><div class="tiny-bar"><span style="width:${c.total?s.count/c.total*100:0}%;background:${s.color}"></span></div></div>`).join("");
}
function getVisibleTasks() {
  const q=$("searchInput")?.value.trim().toLowerCase()||"";
  const status=$("statusFilter")?.value||"all";
  const sort=$("sortSelect")?.value||"date";
  let visible=tasks.filter(t=>(status==="all"||t.status===status)&&(activeFilter==="all"||t.status===activeFilter)&&`${t.title} ${t.subject} ${t.description||""}`.toLowerCase().includes(q));
  if(sort==="priority")visible.sort((a,b)=>priorityRank(a.priority)-priorityRank(b.priority)||a.due.localeCompare(b.due));
  else if(sort==="subject")visible.sort((a,b)=>a.subject.localeCompare(b.subject));
  else visible.sort((a,b)=>a.due.localeCompare(b.due));
  return visible;
}
function renderTaskList() {
  const visible=getVisibleTasks();
  $("taskList").innerHTML=visible.length?visible.map(taskRow).join(""):emptyState("No tasks found","Try changing your filters or add a new task.",true);
  $("listFooter").textContent=`Showing ${visible.length} of ${tasks.length} task${tasks.length===1?"":"s"}.`;
}
function renderProgress() {
  const c=counts();
  $("progressTotal").textContent=c.total; $("progressCompleted").textContent=c.completed; $("progressRemaining").textContent=c.pending;
  $("progressPagePercent").textContent=`${c.percent}%`; $("progressPageCircle").style.setProperty("--progress",`${c.percent}%`);
  $("encouragement").textContent=c.total===0?"Add your first task to start tracking progress.":c.percent===100?"Excellent work — all tasks are complete!":c.percent>=60?"Great progress! Keep working towards your goals.":"Every task starts with one small step.";
  const subjects=[...new Set(tasks.map(t=>t.subject))].sort();
  $("subjectProgress").innerHTML=subjects.length?subjects.map(subject=>{
    const list=tasks.filter(t=>t.subject===subject),done=list.filter(t=>t.status==="Completed").length,pct=Math.round(done/list.length*100);
    return `<div><div class="subject-row-head"><strong>${escapeHTML(subject)}</strong><span>${pct}% · ${done}/${list.length}</span></div><div class="subject-bar"><span style="width:${pct}%"></span></div></div>`;
  }).join(""):emptyState("No subject data yet","Add tasks to see progress by subject.");
  const recent=[...tasks].sort((a,b)=>a.due.localeCompare(b.due));
  $("progressTaskList").innerHTML=recent.length?recent.map(t=>`<div class="compact-task"><input class="task-check" type="checkbox" data-complete="${t.id}" aria-label="Mark ${escapeHTML(t.title)} complete" ${t.status==="Completed"?"checked":""}><span class="compact-title ${t.status==="Completed"?"done":""}">${escapeHTML(t.title)}</span><small>${escapeHTML(fmtDate(t.due))}</small></div>`).join(""):emptyState("No tasks yet","Add tasks to begin tracking your progress.",true);
}
function renderAll() {renderDashboard();renderTaskList();renderProgress();}
function seedDemo() {
  if(!confirm("Replace your current tasks with the sample tasks?"))return;
  tasks=demoTasks.map(t=>({...t,id:crypto.randomUUID()}));saveTasks();renderAll();showToast("Sample tasks restored.");
}
function init() {
  tasks=loadTasks();
  const now=new Date();
  $("todayLabel").textContent=now.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});
  $("fullDate").textContent=now.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
  $("greeting").textContent=`Good ${now.getHours()<12?"morning":now.getHours()<18?"afternoon":"evening"}, Alex 👋`;
  renderAll();

  document.addEventListener("click",e=>{
    const viewBtn=e.target.closest("[data-view]");
    if(viewBtn){navigate(viewBtn.dataset.view);return;}
    const addBtn=e.target.closest("[data-add-task]");
    if(addBtn){openModal();return;}
    const editBtn=e.target.closest("[data-edit]");
    if(editBtn){editTask(editBtn.dataset.edit);return;}
    const deleteBtn=e.target.closest("[data-delete]");
    if(deleteBtn){deleteTask(deleteBtn.dataset.delete);return;}
    const filterBtn=e.target.closest("[data-filter]");
    if(filterBtn){activeFilter=filterBtn.dataset.filter;$("statusFilter").value="all";navigate("tasks");renderTaskList();return;}
  });
  // Delegation handles completion checkboxes, including rows rendered later.
  document.addEventListener("change",e=>{
    if(e.target.matches("[data-complete]"))changeStatus(e.target.dataset.complete,e.target.checked);
  });
  document.querySelectorAll(".nav-link").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
  $("topAddTask").addEventListener("click",()=>openModal());
  $("tasksAddButton").addEventListener("click",()=>openModal());
  $("closeModal").addEventListener("click",closeModal);
  $("cancelModal").addEventListener("click",closeModal);
  $("taskModal").addEventListener("click",e=>{if(e.target===$("taskModal"))closeModal();});
  $("taskForm").addEventListener("submit",upsertTask);
  $("searchInput").addEventListener("input",renderTaskList);
  $("statusFilter").addEventListener("change",()=>{activeFilter="all";renderTaskList();});
  $("sortSelect").addEventListener("change",renderTaskList);
  $("seedDemo").addEventListener("click",seedDemo);
  $("mobileMenu").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});
}
init();
