import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { accountabilityContractService } from '../services/accountability-contract.service.js';

// ─── CRUD ────────────────────────────────────────────────────────────

export const createContract = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const contract = await accountabilityContractService.createContract(userId, req.body);
  ApiResponse.created(res, { contract }, 'Contract created as draft');
});

export const getContracts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { status, limit, offset } = req.query;
  const result = await accountabilityContractService.getContracts(userId, {
    status: status as string | undefined,
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined,
  });

  ApiResponse.success(res, result, 'Contracts retrieved');
});

export const getContract = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const contract = await accountabilityContractService.getContractById(userId, req.params.id);
  if (!contract) throw ApiError.notFound('Contract not found');

  const violations = await accountabilityContractService.getViolations(userId, contract.id, 5);
  ApiResponse.success(res, { contract, recentViolations: violations }, 'Contract retrieved');
});

export const updateContract = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  try {
    const contract = await accountabilityContractService.updateContract(userId, req.params.id, req.body);
    if (!contract) throw ApiError.notFound('Contract not found');
    ApiResponse.success(res, { contract }, 'Contract updated');
  } catch (error) {
    if (error instanceof Error && error.message.includes('only update draft')) {
      throw ApiError.badRequest(error.message);
    }
    throw error;
  }
});

// ─── LIFECYCLE ───────────────────────────────────────────────────────

export const signContract = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const contract = await accountabilityContractService.signContract(userId, req.params.id);
  if (!contract) throw ApiError.badRequest('Contract not found or not in draft status');
  ApiResponse.success(res, { contract }, 'Contract signed and activated');
});

export const pauseContract = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  try {
    const contract = await accountabilityContractService.pauseContract(userId, req.params.id);
    if (!contract) throw ApiError.badRequest('Contract not found or not active');
    ApiResponse.success(res, { contract }, 'Contract paused');
  } catch (error) {
    if (error instanceof Error && error.message.includes('Maximum 2 pauses')) {
      throw ApiError.badRequest(error.message);
    }
    throw error;
  }
});

export const resumeContract = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const contract = await accountabilityContractService.resumeContract(userId, req.params.id);
  if (!contract) throw ApiError.badRequest('Contract not found or not paused');
  ApiResponse.success(res, { contract }, 'Contract resumed');
});

export const cancelContract = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const contract = await accountabilityContractService.cancelContract(
    userId, req.params.id, req.body?.reason
  );
  if (!contract) throw ApiError.badRequest('Contract not found or cannot be cancelled');
  ApiResponse.success(res, { contract }, 'Contract cancelled');
});

// ─── VIOLATIONS & CHECKS ────────────────────────────────────────────

export const getViolations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const violations = await accountabilityContractService.getViolations(
    userId, req.params.id, Number(req.query.limit) || 20
  );
  ApiResponse.success(res, { violations }, 'Violations retrieved');
});

export const disputeViolation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const violation = await accountabilityContractService.disputeViolation(
    userId, req.params.vid, req.body.reason
  );
  if (!violation) throw ApiError.badRequest('Violation not found or not in pending status');
  ApiResponse.success(res, { violation }, 'Violation disputed');
});

export const getChecks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  // Verify user owns the contract
  const contract = await accountabilityContractService.getContractById(userId, req.params.id);
  if (!contract) throw ApiError.notFound('Contract not found');

  const checks = await accountabilityContractService.getChecks(
    req.params.id, Number(req.query.limit) || 30
  );
  ApiResponse.success(res, { checks }, 'Checks retrieved');
});

// ─── ANALYTICS ───────────────────────────────────────────────────────

export const getContractStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const stats = await accountabilityContractService.getContractStats(userId);
  ApiResponse.success(res, { stats }, 'Contract stats retrieved');
});

// ─── AI SUGGESTIONS ──────────────────────────────────────────────────

export const getSuggestions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  // Lazy-import to avoid circular dependencies and only load when needed
  const { contractSuggestionService } = await import('../services/contract-suggestion.service.js');
  const suggestions = await contractSuggestionService.getSuggestions(
    userId, Number(req.query.limit) || 5
  );
  ApiResponse.success(res, { suggestions }, 'Suggestions retrieved');
});

export default {
  createContract,
  getContracts,
  getContract,
  updateContract,
  signContract,
  pauseContract,
  resumeContract,
  cancelContract,
  getViolations,
  disputeViolation,
  getChecks,
  getContractStats,
  getSuggestions,
};
