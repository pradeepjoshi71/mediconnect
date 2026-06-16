import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Building2,
  Plus,
  Trash2,
  Edit,
  Users,
  UserCheck,
  UserX,
  Search,
  BookOpen,
  CheckCircle,
  XCircle,
  FileText,
  UserPlus
} from "lucide-react";
import {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  listDepartmentMembers,
  addDepartmentMember,
  removeDepartmentMember,
  getDepartmentAnalytics
} from "../services/departmentService";
import { listUsers } from "../services/adminService";
import { getUser } from "../services/session";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Select } from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import { KpiCard } from "../components/ui/KpiCard";

export default function AdminDepartments() {
  const [departments, setDepartments] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedDept, setSelectedDept] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal states
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [deptForm, setDeptForm] = useState({ code: "", name: "", description: "", headUserId: "" });
  const [editingDeptId, setEditingDeptId] = useState(null);
  const [selectedUserIdToAdd, setSelectedUserIdToAdd] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currentUser = getUser();

  async function loadData() {
    setLoading(true);
    try {
      const [deptData, analyticsData, usersData] = await Promise.all([
        listDepartments(),
        getDepartmentAnalytics(),
        listUsers()
      ]);
      setDepartments(deptData);
      setAnalytics(analyticsData);
      setUsers(usersData);

      // Restore selected department selection if any
      if (selectedDept) {
        const updated = deptData.find(d => d.id === selectedDept.id);
        if (updated) {
          setSelectedDept(updated);
        } else {
          setSelectedDept(null);
        }
      } else if (deptData.length > 0) {
        setSelectedDept(deptData[0]);
      }
    } catch (err) {
      toast.error("Failed to load departments data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedDept) {
      loadMembers(selectedDept.id);
    } else {
      setMembers([]);
    }
  }, [selectedDept]);

  async function loadMembers(deptId) {
    setLoadingMembers(true);
    try {
      const data = await listDepartmentMembers(deptId);
      setMembers(data);
    } catch {
      toast.error("Failed to load department members");
    } finally {
      setLoadingMembers(false);
    }
  }

  // Handle Create or Edit Department Submit
  async function handleDeptSubmit(e) {
    e.preventDefault();
    if (!deptForm.code || !deptForm.name) {
      toast.error("Department Code and Name are required");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        code: deptForm.code,
        name: deptForm.name,
        description: deptForm.description,
        headUserId: deptForm.headUserId ? Number(deptForm.headUserId) : null
      };

      if (editingDeptId) {
        const updated = await updateDepartment(editingDeptId, payload);
        toast.success("Department updated successfully");
        setIsDeptModalOpen(false);
        await loadData();
      } else {
        const created = await createDepartment(payload);
        toast.success("Department created successfully");
        setIsDeptModalOpen(false);
        await loadData();
        setSelectedDept(created);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save department");
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Delete Department
  async function handleDeleteDept(id) {
    if (!confirm("Are you sure you want to delete this department? This action cannot be undone and will unassign members.")) {
      return;
    }
    try {
      await deleteDepartment(id);
      toast.success("Department deleted successfully");
      setSelectedDept(null);
      await loadData();
    } catch (err) {
      toast.error("Failed to delete department");
    }
  }

  // Handle Add Member Submit
  async function handleAddMember(e) {
    e.preventDefault();
    if (!selectedUserIdToAdd) {
      toast.error("Please select a user");
      return;
    }

    setSubmitting(true);
    try {
      await addDepartmentMember(selectedDept.id, Number(selectedUserIdToAdd));
      toast.success("Member added to department");
      setIsMemberModalOpen(false);
      setSelectedUserIdToAdd("");
      await loadMembers(selectedDept.id);
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add member");
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Remove Member
  async function handleRemoveMember(userId) {
    if (!confirm("Are you sure you want to remove this member from the department?")) {
      return;
    }
    try {
      await removeDepartmentMember(selectedDept.id, userId);
      toast.success("Member removed from department");
      await loadMembers(selectedDept.id);
      await loadData();
    } catch (err) {
      toast.error("Failed to remove member");
    }
  }

  // Open modal for Adding Department
  function openAddDept() {
    setDeptForm({ code: "", name: "", description: "", headUserId: "" });
    setEditingDeptId(null);
    setIsDeptModalOpen(true);
  }

  // Open modal for Editing Department
  function openEditDept(dept) {
    setDeptForm({
      code: dept.code,
      name: dept.name,
      description: dept.description || "",
      headUserId: dept.headUserId || ""
    });
    setEditingDeptId(dept.id);
    setIsDeptModalOpen(true);
  }

  // Filter departments by search text
  const filteredDepts = departments.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Compute metrics
  const totalDepts = departments.length;
  const totalMembersAssigned = analytics.reduce((sum, item) => sum + (item.memberCount || 0), 0);
  const totalDoctorsAssigned = analytics.reduce((sum, item) => sum + (item.doctorCount || 0), 0);

  // Eligible users to add (not already members of the selected department)
  const eligibleUsersToAdd = users.filter(u => 
    !members.some(m => m.id === u.id)
  );

  // Eligible heads (all users with roles admin, hospital_admin, super_admin, or doctor)
  const eligibleHeads = users.filter(u =>
    ["admin", "hospital_admin", "super_admin", "doctor"].includes(u.role)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Hierarchy"
        title="Departments & Ownership"
        description="Organise hospital divisions, appoint department heads, manage staff member affiliations, and view analytics."
        actions={
          <Button onClick={openAddDept} className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-button-glow">
            <Plus className="h-4 w-4" />
            Add Department
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Total Departments"
          value={totalDepts}
          icon={Building2}
          accent="brand"
        />
        <KpiCard
          label="Assigned Clinicians/Staff"
          value={totalMembersAssigned}
          icon={Users}
          accent="teal"
        />
        <KpiCard
          label="Doctors in Departments"
          value={totalDoctorsAssigned}
          icon={UserCheck}
          accent="success"
        />
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-[1fr_2fr] animate-pulse">
          <Skeleton className="h-[500px] rounded-3xl" />
          <Skeleton className="h-[500px] rounded-3xl" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[1fr_2fr] items-start">
          
          {/* Left Panel: Departments List */}
          <Card className="rounded-[24px]">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Departments</span>
                <Badge tone="slate">{filteredDepts.length}</Badge>
              </CardTitle>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
                <Input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search code or name..."
                  className="pl-9 text-xs"
                />
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-4 space-y-1.5 max-h-[500px] overflow-y-auto">
              {filteredDepts.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No departments found.
                </div>
              ) : (
                filteredDepts.map(dept => {
                  const isSelected = selectedDept && selectedDept.id === dept.id;
                  return (
                    <button
                      key={dept.id}
                      onClick={() => setSelectedDept(dept)}
                      className={`w-full text-left rounded-xl p-3 transition-all duration-200 flex items-center justify-between group ${
                        isSelected
                          ? "bg-brand-500 text-white shadow-premium-glow"
                          : "hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <div className="truncate">
                        <div className={`font-semibold text-sm ${isSelected ? "text-white" : "text-slate-900 dark:text-white"}`}>
                          {dept.name}
                        </div>
                        <div className={`text-[10px] uppercase font-mono tracking-wider ${isSelected ? "text-brand-100" : "text-slate-400"}`}>
                          {dept.code}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={isSelected ? "slate" : "brand"} className="text-[10px]">
                          {dept.memberCount || 0}
                        </Badge>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Right Panel: Selected Department Details & Members */}
          {selectedDept ? (
            <div className="space-y-6">
              
              {/* Department Overview */}
              <Card className="rounded-[24px] overflow-hidden relative">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-brand-600 to-tealish-600" />
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider font-mono">
                      Department Profile · {selectedDept.code}
                    </div>
                    <CardTitle className="text-2xl font-black mt-1">
                      {selectedDept.name}
                    </CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEditDept(selectedDept)}>
                      <Edit className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteDept(selectedDept.id)}
                      className="border-red-200 bg-red-50/10 text-red-650 hover:bg-red-50/30 dark:border-red-950/20 dark:text-red-400"
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedDept.description && (
                    <div className="text-sm text-slate-600 dark:text-slate-350 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800/40">
                      {selectedDept.description}
                    </div>
                  )}

                  {/* Department Head Info */}
                  <div className="flex flex-wrap items-center gap-4 bg-teal-50/20 dark:bg-teal-950/5 p-4 rounded-xl border border-teal-100 dark:border-teal-950/25">
                    <div className="h-10 w-10 rounded-xl bg-teal-500/20 flex items-center justify-center text-teal-600">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                        Department Head / Chief
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {selectedDept.headFullName || "Unassigned"}
                      </div>
                      {selectedDept.headEmail && (
                        <div className="text-xs text-slate-400">
                          {selectedDept.headEmail}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Members List */}
              <Card className="rounded-[24px]">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-brand-500" />
                    <span>Affiliated Members & Staff</span>
                    <Badge tone="brand">{members.length}</Badge>
                  </CardTitle>
                  <Button size="sm" onClick={() => setIsMemberModalOpen(true)} className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg">
                    <UserPlus className="h-4 w-4 mr-1" /> Add Member
                  </Button>
                </CardHeader>
                <CardContent>
                  {loadingMembers ? (
                    <div className="space-y-2 py-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : members.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                      <Users className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-350">
                        No members assigned yet
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Map clinical or administrative staff to structure this department's hierarchy.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase">
                            <th className="pb-3 pt-1">Name / Contact</th>
                            <th className="pb-3 pt-1">Role</th>
                            <th className="pb-3 pt-1 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-900/60 text-sm">
                          {members.map(member => (
                            <tr key={member.id} className="group">
                              <td className="py-3">
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {member.fullName}
                                </div>
                                <div className="text-xs text-slate-400">{member.email}</div>
                              </td>
                              <td className="py-3">
                                <Badge tone={member.role === "doctor" ? "teal" : "slate"} className="capitalize">
                                  {member.role?.replace("_", " ")}
                                </Badge>
                              </td>
                              <td className="py-3 text-right">
                                <button
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="text-red-500 hover:text-red-700 p-1 bg-transparent hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                                  title="Remove from Department"
                                >
                                  <UserX className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          ) : (
            <Card className="rounded-[24px] py-16 text-center">
              <CardContent className="space-y-3">
                <Building2 className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700" />
                <div className="text-lg font-black text-slate-850 dark:text-slate-205">No Department Selected</div>
                <p className="text-sm text-slate-450 max-w-sm mx-auto">
                  Select a department from the left panel to manage its members, chiefs, configurations, and division analytics.
                </p>
              </CardContent>
            </Card>
          )}

        </div>
      )}

      {/* Create / Edit Department Modal */}
      <Modal
        open={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        title={editingDeptId ? "Modify Department" : "Establish New Department"}
      >
        <form onSubmit={handleDeptSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block sm:col-span-1">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Code (Unique) *</span>
              <Input
                value={deptForm.code}
                onChange={e => setDeptForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. CARD"
                disabled={!!editingDeptId}
                required
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Department Name *</span>
              <Input
                value={deptForm.name}
                onChange={e => setDeptForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Cardiology & Vascular Clinic"
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Description</span>
            <textarea
              value={deptForm.description}
              onChange={e => setDeptForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-850 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/70 mt-1"
              placeholder="Detail the services, scope, or division specifics..."
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Department Head (Chief)</span>
            <Select
              value={deptForm.headUserId}
              onChange={e => setDeptForm(f => ({ ...f, headUserId: e.target.value }))}
              className="mt-1 bg-white"
            >
              <option value="">-- Assign a Chief (Optional) --</option>
              {eligibleHeads.map(u => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.role?.replace("_", " ")})
                </option>
              ))}
            </Select>
          </label>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsDeptModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl">
              {editingDeptId ? "Save Changes" : "Create Department"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        open={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        title={`Add Member to ${selectedDept?.name}`}
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Select Hospital User / Practitioner</span>
            <Select
              value={selectedUserIdToAdd}
              onChange={e => setSelectedUserIdToAdd(e.target.value)}
              className="mt-1 bg-white"
              required
            >
              <option value="">-- Choose User --</option>
              {eligibleUsersToAdd.map(u => (
                <option key={u.id} value={u.id}>
                  {u.fullName} - {u.email} ({u.role?.replace("_", " ")})
                </option>
              ))}
            </Select>
          </label>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsMemberModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl">
              Add Member
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
