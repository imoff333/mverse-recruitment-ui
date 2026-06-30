const KEY = 'mverse-recruitment-token';

export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t: string) => localStorage.setItem(KEY, t);
export const clearToken = () => localStorage.removeItem(KEY);

/** Capture the SSO token handed off from the People launcher (#t=…), store it, scrub the fragment. */
export function captureHandoffToken() {
  const m = location.hash.match(/[#&]t=([^&]+)/);
  if (m) {
    setToken(decodeURIComponent(m[1]));
    history.replaceState(null, '', location.pathname + location.search);
  }
}

const headers = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
};
async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, { method, headers: headers(), body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) throw new Error(String(res.status));
  return res.status === 204 ? (undefined as T) : res.json();
}
export const apiGet = <T>(p: string) => req<T>('GET', p);
export const apiPost = <T>(p: string, b?: unknown) => req<T>('POST', p, b ?? {});
export const apiPatch = <T>(p: string, b: unknown) => req<T>('PATCH', p, b);
export const apiPut = <T>(p: string, b: unknown) => req<T>('PUT', p, b);
export const apiDelete = <T>(p: string) => req<T>('DELETE', p);

// ── Types ────────────────────────────────────────────────────────────────────
export interface Me { email: string; role: string; orgSlug: string; orgName: string; canEdit?: boolean }
export type ProjectStatus = 'planning' | 'active' | 'onHold' | 'complete' | 'cancelled';
export type BugSeverity = 'critical' | 'high' | 'medium' | 'low';
export interface Eff { estimatedHours: number; remainingHours: number; completedHours: number }

export type Rag = 'red' | 'amber' | 'green';
export interface ProjectListItem { id: string; name: string; status: ProjectStatus; startDate: string | null; finishDate: string | null; _count: { milestones: number; members: number }; rag?: Rag | null }
export interface RagSnapshot { id: string; weekOf: string; rag: Rag; score: number; drivers: string[]; computedAt: string }
export interface RagResult { rag: Rag; score: number; dimensions: { schedule: string; risk: string; issue: string }; drivers: string[] }
export interface RagInfo { latest: RagSnapshot | null; history: RagSnapshot[]; override: { rag: Rag; reason: string | null; at: string } | null }
export interface TimeLog { id: string; taskId: string; personId: string; date: string; hours: number; note: string | null }
export interface BaselineItem { kind: string; id: string; title: string; start: string | null; finish: string | null; estimatedHours: number }
export interface AutomationRule { id: string; name: string; triggerType: 'task_status' | 'overdue'; triggerConfig: { statusId?: string }; actionType: 'post' | 'flag_risk'; actionConfig: { message?: string }; enabled: boolean }
export interface ScenarioRow { taskId: string; title: string; estimatedHours: number; startDate: string | null; finishDate: string | null }
export interface Scenario { id: string; name: string; data: ScenarioRow[]; createdAt: string }
export interface Baseline { id: string; name: string; capturedAt: string; data: BaselineItem[] }
export interface Workstream { id: string; name: string; color: string; sortOrder: number }
export interface Status { id: string; name: string; color: string; sortOrder: number }
export interface ItemBase extends Eff { id: string; title: string; description: string | null; startDate: string | null; finishDate: string | null; workstreamId: string | null; ownerPersonId: string | null; statusId: string | null; sortOrder: number }
export interface Task extends ItemBase { assignees: { id: string; personId: string }[]; scheduledStart: string | null; scheduledFinish: string | null; notBeforeDate: string | null; predecessorOffsetDays: number | null; requiredSkills: string[] | null }
export interface ProjectAbsence { from: string; to: string; absence: Record<string, { date: string; type: string; label: string }[]> }
export interface Attachment { id: string; kind: 'link' | 'file'; label: string | null; url: string | null; fileName: string | null; contentType: string | null; size: number | null; createdAt: string }
export interface RaidEntry {
  id: string; type: 'risk' | 'assumption' | 'issue' | 'dependency'; ref: number; title: string; description: string | null; status: string;
  ownerPersonId: string | null; raisedDate: string | null; dueDate: string | null;
  probability: number | null; impact: number | null; response: string | null; mitigation: string | null;
  priority: string | null; resolution: string | null; confidence: string | null; validated: boolean | null; direction: string | null; dependsOn: string | null;
}
export interface Bug extends ItemBase { severity: BugSeverity; scheduledStart: string | null; scheduledFinish: string | null }
export interface Training extends ItemBase { assignees: { id: string; personId: string }[]; scheduledStart: string | null; scheduledFinish: string | null; courseId: string | null; microlessonId: string | null; content: string | null; passingScore: number | null }
export interface LearningCourse { id: string; title: string; shortDescription: string | null; durationMinutes: number | null; passingScore: number | null }
export interface LearningMicrolesson { id: string; title: string; summary: string | null; durationMins: number; quiz: unknown }
export interface Requirement extends ItemBase { tasks: Task[]; bugs: Bug[]; trainings: Training[]; rolled: Eff }
export interface Milestone extends ItemBase { requirements: Requirement[]; rolled: Eff }
export interface ProjectDetail {
  id: string; name: string; description: string | null; status: ProjectStatus; startDate: string | null; finishDate: string | null; ownerPersonId: string | null;
  milestones: Milestone[]; rolled: Eff; budget: number | null;
}
export interface Person { id: string; firstName: string; lastName: string; email: string; jobTitle: string; department: { id: string; name: string } | null; external?: boolean; costRate?: number | null; managerId?: string | null; skills?: { name: string; level: string | null }[] }
export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox';
export interface CustomFieldDef { id: string; entity: string; label: string; type: CustomFieldType; options: string[] | null; sortOrder: number }
export interface CustomFieldValue { id: string; defId: string; entityType: string; entityId: string; value: unknown }
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export interface Approval { id: string; entityType: string; entityId: string; entityTitle: string; requestedByEmail: string; requestedByPersonId: string | null; approverPersonId: string; status: ApprovalStatus; note: string | null; decisionNote: string | null; createdAt: string; decidedAt: string | null }
export interface ProjectCost { budget: number | null; plannedCost: number; actualCost: number; rated: number; ev: number; pv: number; spi: number | null; cpi: number | null; eac: number | null }
export interface MyWorkTask { id: string; title: string; start: string | null; finish: string | null; estimatedHours: number; remainingHours: number; statusId: string | null; isOwner: boolean; projectId: string; projectName: string; milestone: string }
export interface MyWork { personId: string | null; tasks: MyWorkTask[] }
export interface PortfolioProject { id: string; name: string; status: ProjectStatus; budget: number | null; rag: Rag | null; milestones: number; members: number; openRisks: number }
export interface PortfolioInfo { projects: PortfolioProject[]; overAllocated: { personId: string; pct: number }[] }
export type LessonStatus = 'active' | 'closed';
export interface Lesson { id: string; projectId: string | null; workstreamId: string | null; date: string; title: string; description: string | null; proposedActions: string | null; status: LessonStatus; createdAt: string; project: { id: string; name: string } | null; workstream: { id: string; name: string } | null }
export type GoalStatus = 'on_track' | 'at_risk' | 'off_track' | 'done';
export interface Goal { id: string; projectId: string | null; title: string; description: string | null; ownerPersonId: string | null; period: string | null; parentId: string | null; targetValue: number | null; currentValue: number | null; unit: string | null; status: GoalStatus; sortOrder: number; projectLinks: { projectId: string; project: { name: string } }[] }
export interface ExternalPerson { id: string; firstName: string; lastName: string; email: string | null; company: string | null; role: string | null; createdAt: string }
export interface Mention { personId: string; name: string; email?: string }
export interface Member { id: string; personId: string; role: string | null; allocationPct: number; costRate: number | null }
export interface Stakeholder { id: string; projectId: string; name: string; role: string | null; organisation: string | null; personId: string | null; category: string; influence: number; interest: number; attitude: string; currentEngagement: string; desiredEngagement: string; communicationFreq: string | null; notes: string | null; sortOrder: number }
export interface WorkPattern { monHours: number; tueHours: number; wedHours: number; thuHours: number; friHours: number; satHours: number; sunHours: number }
export interface CapacityWeek { weekStart: string; capacityHours: number; absenceDays: number }
export interface CapacityRow { personId: string; role: string | null; allocationPct: number; peopleError: boolean; weekly: CapacityWeek[]; totalCapacity: number }
export interface Capacity { from: string; to: string; weeks: string[]; members: CapacityRow[] }
export interface Dependency { id: string; predecessorId: string; successorId: string; type: string }
export interface ScheduleFlag { taskId: string; spill?: boolean; resourceConstrained?: boolean; unassigned?: boolean }
export interface ScheduleResult { scheduled: number; flags: ScheduleFlag[]; from: string; to: string }
export interface Post { id: string; itemType: string; itemId: string; itemTitle: string; authorEmail: string; authorName: string | null; body: string; mentions: Mention[]; createdAt: string }
export interface FeedPost { id: string; projectId: string; projectName: string; itemType: string; itemId: string; itemTitle: string; authorEmail: string; body: string; mentions: Mention[]; createdAt: string }
