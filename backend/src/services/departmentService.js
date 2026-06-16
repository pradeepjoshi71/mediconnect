const departmentRepository = require("../repositories/departmentRepository");
const authRepository = require("../repositories/authRepository");
const { recordAuditEvent } = require("./auditService");
const { AppError } = require("../utils/http");

async function listDepartments(user) {
  if (!user?.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }
  return departmentRepository.listDepartments(user.hospitalId);
}

async function getDepartment(user, id) {
  if (!user?.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }
  const department = await departmentRepository.findDepartmentById(id, user.hospitalId);
  if (!department) {
    throw new AppError(404, "Department not found");
  }
  return department;
}

async function createDepartment(user, data, context) {
  if (!user?.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }
  if (!data.code || !data.name) {
    throw new AppError(400, "Department code and name are required");
  }

  // Check unique code within hospital
  const existing = await departmentRepository.findDepartmentByCode(data.code, user.hospitalId);
  if (existing) {
    throw new AppError(400, `Department with code '${data.code}' already exists`);
  }

  // Check head user if provided
  if (data.headUserId) {
    const headUser = await authRepository.findUserById(data.headUserId);
    if (!headUser || headUser.hospitalId !== user.hospitalId) {
      throw new AppError(400, "Assigned head user not found in this hospital");
    }
  }

  const department = await departmentRepository.createDepartment({
    hospitalId: user.hospitalId,
    code: data.code,
    name: data.name,
    description: data.description,
    headUserId: data.headUserId,
  });

  await recordAuditEvent({
    user,
    action: "department.created",
    entityType: "departments",
    entityId: department.id.toString(),
    newValue: department,
    context,
  });

  return department;
}

async function updateDepartment(user, id, data, context) {
  if (!user?.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }

  const oldDept = await departmentRepository.findDepartmentById(id, user.hospitalId);
  if (!oldDept) {
    throw new AppError(404, "Department not found");
  }

  // Check head user if provided
  if (data.headUserId) {
    const headUser = await authRepository.findUserById(data.headUserId);
    if (!headUser || headUser.hospitalId !== user.hospitalId) {
      throw new AppError(400, "Assigned head user not found in this hospital");
    }
  }

  const department = await departmentRepository.updateDepartment(id, user.hospitalId, {
    name: data.name || oldDept.name,
    description: data.description !== undefined ? data.description : oldDept.description,
    headUserId: data.headUserId !== undefined ? data.headUserId : oldDept.headUserId,
  });

  await recordAuditEvent({
    user,
    action: "department.updated",
    entityType: "departments",
    entityId: id.toString(),
    oldValue: oldDept,
    newValue: department,
    context,
  });

  return department;
}

async function deleteDepartment(user, id, context) {
  if (!user?.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }

  const oldDept = await departmentRepository.findDepartmentById(id, user.hospitalId);
  if (!oldDept) {
    throw new AppError(404, "Department not found");
  }

  const deleted = await departmentRepository.deleteDepartment(id, user.hospitalId);
  if (!deleted) {
    throw new AppError(400, "Failed to delete department");
  }

  await recordAuditEvent({
    user,
    action: "department.deleted",
    entityType: "departments",
    entityId: id.toString(),
    oldValue: oldDept,
    context,
  });

  return { success: true };
}

async function addDepartmentMember(user, departmentId, userId, context) {
  if (!user?.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }

  const department = await departmentRepository.findDepartmentById(departmentId, user.hospitalId);
  if (!department) {
    throw new AppError(404, "Department not found");
  }

  const memberUser = await authRepository.findUserById(userId);
  if (!memberUser || memberUser.hospitalId !== user.hospitalId) {
    throw new AppError(400, "User not found in this hospital");
  }

  const result = await departmentRepository.addDepartmentMember(departmentId, userId);

  await recordAuditEvent({
    user,
    action: "department.member.added",
    entityType: "department_members",
    entityId: `${departmentId}_${userId}`,
    newValue: { departmentId, userId },
    context,
  });

  return result || { departmentId, userId };
}

async function removeDepartmentMember(user, departmentId, userId, context) {
  if (!user?.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }

  const department = await departmentRepository.findDepartmentById(departmentId, user.hospitalId);
  if (!department) {
    throw new AppError(404, "Department not found");
  }

  const removed = await departmentRepository.removeDepartmentMember(departmentId, userId);
  if (!removed) {
    throw new AppError(404, "Member not found in this department");
  }

  await recordAuditEvent({
    user,
    action: "department.member.removed",
    entityType: "department_members",
    entityId: `${departmentId}_${userId}`,
    oldValue: { departmentId, userId },
    context,
  });

  return { success: true };
}

async function listDepartmentMembers(user, departmentId) {
  if (!user?.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }

  const department = await departmentRepository.findDepartmentById(departmentId, user.hospitalId);
  if (!department) {
    throw new AppError(404, "Department not found");
  }

  return departmentRepository.listDepartmentMembers(departmentId, user.hospitalId);
}

async function getDepartmentAnalytics(user) {
  if (!user?.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }
  return departmentRepository.getDepartmentAnalytics(user.hospitalId);
}

module.exports = {
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  addDepartmentMember,
  removeDepartmentMember,
  listDepartmentMembers,
  getDepartmentAnalytics,
};
