import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Request, StreamableFile } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { FEASIBILITY_EDIT_ROLES, FEASIBILITY_VIEW_ROLES, FEASIBILITY_EXPORT_ROLES, FEASIBILITY_RUN_CALCULATIONS_ROLES, FEASIBILITY_REPORT_TRANSITION_ROLES } from '../auth/roles.constants'
import { actorFrom, tenantFrom } from '../common/actor'
import { mapDomainErrors } from '../common/errors/domain-error'
import {
  CreateFeasibilityAreaDto, CreateFeasibilityAssumptionDto,
  CreateFeasibilityProfileDto, CreateFeasibilitySourceDto, CreateGushChelkaDto, UpdateGushChelkaDto, UpdateFeasibilitySourceDto,
  CreatePlanningRightDto, UpdatePlanningRightDto, CreateFeasibilityScenarioDto, CreateUnitMixLineDto, CreateReplacementAllocationDto, UpdateReplacementAllocationDto, UpdateUnitMixLineDto,
  CreateFeasibilityRevenueLineDto, CreateFeasibilityCostLineDto,
  UpdateFeasibilityRevenueLineDto, UpdateFeasibilityCostLineDto,
  CreateFeasibilityCashFlowAllocationDto, UpdateFeasibilityCashFlowAllocationDto, CreateFeasibilityTimelinePhaseDto, UpdateFeasibilityProfileDto, UpdateFeasibilityAssumptionDto, UpdateFeasibilityAreaDto,
  CreateFeasibilityCompensationLineDto, UpdateFeasibilityCompensationLineDto,
  CreateComparableAdjustmentDto, CreateComparableTransactionDto, UpdateComparableAdjustmentDto, UpdateComparableTransactionDto,
  CreateFeasibilitySnapshotDto,
  CreateSensitivityDto, CreateGoalSeekDto, SolveFinancingDto, CreateMonteCarloDto, CreateEquityTrancheDto, UpdateEquityTrancheDto, UpdateFeasibilityScenarioDto,
  CreateFeasibilityReportVersionDto,
  TransitionFeasibilityReportVersionDto,
  UpsertFeasibilityFinancingDto,
} from './dto/feasibility-foundation.dto'
import { FeasibilityService } from './feasibility.service'
import { FeasibilityCalculationService } from './feasibility-calculation.service'
import { FeasibilityReportVersionService } from './feasibility-report-version.service'
import { FeasibilityExcelExportService } from './feasibility-excel-export.service'
import { FeasibilityPdfExportService } from './feasibility-pdf-export.service'

@ApiTags('feasibility')
@ApiBearerAuth()
@Roles(...FEASIBILITY_VIEW_ROLES)
@Controller({ path: 'projects/:projectId/feasibility', version: '1' })
export class FeasibilityController {
  constructor(
    private readonly feasibility: FeasibilityService,
    private readonly calculations: FeasibilityCalculationService,
    private readonly reportVersions: FeasibilityReportVersionService,
    private readonly excelExports: FeasibilityExcelExportService,
    private readonly pdfExports: FeasibilityPdfExportService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Read one project feasibility foundation' })
  find(@Param('projectId') projectId: string, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.find(projectId, tenantFrom(req)))
  }

  @Post()
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Create the feasibility profile for a project' })
  create(@Param('projectId') projectId: string, @Body() dto: CreateFeasibilityProfileDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.create(projectId, dto, actorFrom(req)))
  }

  @Patch()
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Update professional profile metadata while draft/review' })
  update(@Param('projectId') projectId: string, @Body() dto: UpdateFeasibilityProfileDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.update(projectId, dto, actorFrom(req)))
  }

  @Post('parcels')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  addParcel(@Param('projectId') projectId: string, @Body() dto: CreateGushChelkaDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.addParcel(projectId, dto, actorFrom(req)))
  }

  @Patch('parcels/:parcelId')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  updateParcel(@Param('projectId') projectId: string, @Param('parcelId') parcelId: string, @Body() dto: UpdateGushChelkaDto, @Request() req: any) { return mapDomainErrors(() => this.feasibility.updateParcel(projectId, parcelId, dto, actorFrom(req))) }

  @Delete('parcels/:parcelId')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  deleteParcel(@Param('projectId') projectId: string, @Param('parcelId') parcelId: string, @Request() req: any) { return mapDomainErrors(() => this.feasibility.deleteParcel(projectId, parcelId, actorFrom(req))) }

  @Post('sources')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  addSource(@Param('projectId') projectId: string, @Body() dto: CreateFeasibilitySourceDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.addSource(projectId, dto, actorFrom(req)))
  }

  @Patch('sources/:sourceId')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  updateSource(@Param('projectId') projectId: string, @Param('sourceId') sourceId: string, @Body() dto: UpdateFeasibilitySourceDto, @Request() req: any) { return mapDomainErrors(() => this.feasibility.updateSource(projectId, sourceId, dto, actorFrom(req))) }

  @Delete('sources/:sourceId')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  deleteSource(@Param('projectId') projectId: string, @Param('sourceId') sourceId: string, @Request() req: any) { return mapDomainErrors(() => this.feasibility.deleteSource(projectId, sourceId, actorFrom(req))) }

  @Post('assumptions')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  addAssumption(@Param('projectId') projectId: string, @Body() dto: CreateFeasibilityAssumptionDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.addAssumption(projectId, dto, actorFrom(req)))
  }
  @Patch('assumptions/:assumptionId') @Roles(...FEASIBILITY_EDIT_ROLES)
  updateAssumption(@Param('projectId') projectId: string, @Param('assumptionId') assumptionId: string, @Body() dto: UpdateFeasibilityAssumptionDto, @Request() req: any) { return mapDomainErrors(() => this.feasibility.updateAssumption(projectId, assumptionId, dto, actorFrom(req))) }
  @Delete('assumptions/:assumptionId') @Roles(...FEASIBILITY_EDIT_ROLES)
  deleteAssumption(@Param('projectId') projectId: string, @Param('assumptionId') assumptionId: string, @Request() req: any) { return mapDomainErrors(() => this.feasibility.deleteAssumption(projectId, assumptionId, actorFrom(req))) }

  @Post('areas')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  addArea(@Param('projectId') projectId: string, @Body() dto: CreateFeasibilityAreaDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.addArea(projectId, dto, actorFrom(req)))
  }
  @Patch('areas/:areaId') @Roles(...FEASIBILITY_EDIT_ROLES)
  updateArea(@Param('projectId') projectId: string, @Param('areaId') areaId: string, @Body() dto: UpdateFeasibilityAreaDto, @Request() req: any) { return mapDomainErrors(() => this.feasibility.updateArea(projectId, areaId, dto, actorFrom(req))) }
  @Delete('areas/:areaId') @Roles(...FEASIBILITY_EDIT_ROLES)
  deleteArea(@Param('projectId') projectId: string, @Param('areaId') areaId: string, @Request() req: any) { return mapDomainErrors(() => this.feasibility.deleteArea(projectId, areaId, actorFrom(req))) }

  @Post('planning-rights')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  addPlanningRight(@Param('projectId') projectId: string, @Body() dto: CreatePlanningRightDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.addPlanningRight(projectId, dto, actorFrom(req)))
  }
  @Patch('planning-rights/:rightId') @Roles(...FEASIBILITY_EDIT_ROLES)
  updatePlanningRight(@Param('projectId') projectId: string, @Param('rightId') rightId: string, @Body() dto: UpdatePlanningRightDto, @Request() req: any) { return mapDomainErrors(() => this.feasibility.updatePlanningRight(projectId, rightId, dto, actorFrom(req))) }
  @Delete('planning-rights/:rightId') @Roles(...FEASIBILITY_EDIT_ROLES)
  deletePlanningRight(@Param('projectId') projectId: string, @Param('rightId') rightId: string, @Request() req: any) { return mapDomainErrors(() => this.feasibility.deletePlanningRight(projectId, rightId, actorFrom(req))) }

  @Post('scenarios')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Create an independent planning/economic scenario' })
  addScenario(@Param('projectId') projectId: string, @Body() dto: CreateFeasibilityScenarioDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.addScenario(projectId, dto, actorFrom(req)))
  }

  @Patch('scenarios/:scenarioId')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: "Edit a scenario's own attributes, including the non-cash consideration given for the land" })
  updateScenario(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Body() dto: UpdateFeasibilityScenarioDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.updateScenario(projectId, scenarioId, dto, actorFrom(req)))
  }

  @Post('scenarios/:scenarioId/duplicate')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Duplicate a scenario and its unit mix without changing the original' })
  duplicateScenario(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.duplicateScenario(projectId, scenarioId, actorFrom(req)))
  }

  @Post('scenarios/:scenarioId/unit-mix')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Add an explicit proposed unit-mix line to a scenario' })
  addUnitMixLine(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Body() dto: CreateUnitMixLineDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.addUnitMixLine(projectId, scenarioId, dto, actorFrom(req)))
  }

  @Patch('scenarios/:scenarioId/unit-mix/:lineId')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Update one explicit proposed unit-mix line' })
  updateUnitMixLine(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Param('lineId') lineId: string, @Body() dto: UpdateUnitMixLineDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.updateUnitMixLine(projectId, scenarioId, lineId, dto, actorFrom(req)))
  }

  @Delete('scenarios/:scenarioId/unit-mix/:lineId')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Delete one explicit proposed unit-mix line and preserve audit history' })
  deleteUnitMixLine(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Param('lineId') lineId: string, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.deleteUnitMixLine(projectId, scenarioId, lineId, actorFrom(req)))
  }

  /**
   * Which replacement flat goes to which owner holding.
   *
   * Nested under the unit-mix line rather than the scenario because an
   * allocation has no meaning apart from the line it divides up, and because
   * the line is where the OWNER_REPLACEMENT classification lives that decides
   * whether allocations are legitimate here at all.
   */
  @Post('scenarios/:scenarioId/unit-mix/:lineId/replacement-allocations')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Allocate a replacement flat, or a share of one, to an existing owner holding' })
  addReplacementAllocation(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Param('lineId') lineId: string, @Body() dto: CreateReplacementAllocationDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.addReplacementAllocation(projectId, scenarioId, lineId, dto, actorFrom(req)))
  }

  @Patch('scenarios/:scenarioId/unit-mix/:lineId/replacement-allocations/:allocationId')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Correct one replacement allocation' })
  updateReplacementAllocation(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Param('lineId') lineId: string, @Param('allocationId') allocationId: string, @Body() dto: UpdateReplacementAllocationDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.updateReplacementAllocation(projectId, scenarioId, lineId, allocationId, dto, actorFrom(req)))
  }

  @Delete('scenarios/:scenarioId/unit-mix/:lineId/replacement-allocations/:allocationId')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Remove one replacement allocation and preserve audit history' })
  deleteReplacementAllocation(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Param('lineId') lineId: string, @Param('allocationId') allocationId: string, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.deleteReplacementAllocation(projectId, scenarioId, lineId, allocationId, actorFrom(req)))
  }

  @Post('scenarios/:scenarioId/revenue-lines')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Add one source-traceable scenario revenue input line' })
  addRevenueLine(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Body() dto: CreateFeasibilityRevenueLineDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.addRevenueLine(projectId, scenarioId, dto, actorFrom(req)))
  }

  @Post('scenarios/:scenarioId/cost-lines')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Add one source-traceable scenario cost input line' })
  addCostLine(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Body() dto: CreateFeasibilityCostLineDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.addCostLine(projectId, scenarioId, dto, actorFrom(req)))
  }

  @Patch('scenarios/:scenarioId/revenue-lines/:lineId')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Update one source-traceable scenario revenue input line' })
  updateRevenueLine(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Param('lineId') lineId: string, @Body() dto: UpdateFeasibilityRevenueLineDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.updateRevenueLine(projectId, scenarioId, lineId, dto, actorFrom(req)))
  }

  @Patch('scenarios/:scenarioId/cost-lines/:lineId')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Update one source-traceable scenario cost input line' })
  updateCostLine(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Param('lineId') lineId: string, @Body() dto: UpdateFeasibilityCostLineDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.updateCostLine(projectId, scenarioId, lineId, dto, actorFrom(req)))
  }

  @Delete('scenarios/:scenarioId/revenue-lines/:lineId')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Delete an unallocated revenue line and preserve an audit event' })
  deleteRevenueLine(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Param('lineId') lineId: string, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.deleteRevenueLine(projectId, scenarioId, lineId, actorFrom(req)))
  }

  @Delete('scenarios/:scenarioId/cost-lines/:lineId')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Delete an unallocated cost line and preserve an audit event' })
  deleteCostLine(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Param('lineId') lineId: string, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.deleteCostLine(projectId, scenarioId, lineId, actorFrom(req)))
  }

  @Patch('scenarios/:scenarioId/financing')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Create or update the scenario financing assumptions' })
  upsertFinancing(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Body() dto: UpsertFeasibilityFinancingDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.upsertFinancing(projectId, scenarioId, dto, actorFrom(req)))
  }

  @Post('scenarios/:scenarioId/timeline-phases')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Add a timeline phase used by monthly cash flow calculations' })
  addTimelinePhase(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Body() dto: CreateFeasibilityTimelinePhaseDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.addTimelinePhase(projectId, scenarioId, dto, actorFrom(req)))
  }
  @Delete('scenarios/:scenarioId/timeline-phases/:phaseId') @Roles(...FEASIBILITY_EDIT_ROLES)
  deleteTimelinePhase(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Param('phaseId') phaseId: string, @Request() req: any) { return mapDomainErrors(() => this.feasibility.deleteTimelinePhase(projectId, scenarioId, phaseId, actorFrom(req))) }

  @Post('scenarios/:scenarioId/cash-flow-allocations')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Add one explicit monthly cash-flow allocation, linked to a revenue or cost input where applicable' })
  addCashFlowAllocation(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Body() dto: CreateFeasibilityCashFlowAllocationDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.addCashFlowAllocation(projectId, scenarioId, dto, actorFrom(req)))
  }
  @Patch('scenarios/:scenarioId/cash-flow-allocations/:allocationId') @Roles(...FEASIBILITY_EDIT_ROLES)
  updateCashFlowAllocation(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Param('allocationId') allocationId: string, @Body() dto: UpdateFeasibilityCashFlowAllocationDto, @Request() req: any) { return mapDomainErrors(() => this.feasibility.updateCashFlowAllocation(projectId, scenarioId, allocationId, dto, actorFrom(req))) }
  @Delete('scenarios/:scenarioId/cash-flow-allocations/:allocationId') @Roles(...FEASIBILITY_EDIT_ROLES)
  deleteCashFlowAllocation(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Param('allocationId') allocationId: string, @Request() req: any) { return mapDomainErrors(() => this.feasibility.deleteCashFlowAllocation(projectId, scenarioId, allocationId, actorFrom(req))) }

  @Post('scenarios/:scenarioId/compensations')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Add one per-ownership compensation package, linked to the existing ownership registry' })
  addCompensationLine(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Body() dto: CreateFeasibilityCompensationLineDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.addCompensationLine(projectId, scenarioId, dto, actorFrom(req)))
  }
  @Patch('scenarios/:scenarioId/compensations/:lineId') @Roles(...FEASIBILITY_EDIT_ROLES)
  updateCompensationLine(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Param('lineId') lineId: string, @Body() dto: UpdateFeasibilityCompensationLineDto, @Request() req: any) { return mapDomainErrors(() => this.feasibility.updateCompensationLine(projectId, scenarioId, lineId, dto, actorFrom(req))) }
  @Delete('scenarios/:scenarioId/compensations/:lineId') @Roles(...FEASIBILITY_EDIT_ROLES)
  deleteCompensationLine(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Param('lineId') lineId: string, @Request() req: any) { return mapDomainErrors(() => this.feasibility.deleteCompensationLine(projectId, scenarioId, lineId, actorFrom(req))) }

  @Post('comparables')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Add a tenant-scoped market comparable with its source evidence' })
  addComparable(@Param('projectId') projectId: string, @Body() dto: CreateComparableTransactionDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.addComparableTransaction(projectId, dto, actorFrom(req)))
  }

  @Patch('comparables/:comparableId')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Update a tenant-scoped market comparable while the profile is editable' })
  updateComparable(@Param('projectId') projectId: string, @Param('comparableId') comparableId: string, @Body() dto: UpdateComparableTransactionDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.updateComparableTransaction(projectId, comparableId, dto, actorFrom(req)))
  }

  @Post('comparables/:comparableId/adjustments')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Add one auditable multiplicative adjustment to a comparable' })
  addComparableAdjustment(@Param('projectId') projectId: string, @Param('comparableId') comparableId: string, @Body() dto: CreateComparableAdjustmentDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.addComparableAdjustment(projectId, comparableId, dto, actorFrom(req)))
  }

  @Patch('comparables/:comparableId/adjustments/:adjustmentId')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Update a tenant-scoped comparable adjustment while the profile is editable' })
  updateComparableAdjustment(@Param('projectId') projectId: string, @Param('comparableId') comparableId: string, @Param('adjustmentId') adjustmentId: string, @Body() dto: UpdateComparableAdjustmentDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.updateComparableAdjustment(projectId, comparableId, adjustmentId, dto, actorFrom(req)))
  }

  @Post('scenarios/:scenarioId/calculate')
  @Roles(...FEASIBILITY_RUN_CALCULATIONS_ROLES)
  @ApiOperation({ summary: 'Calculate live traceable feasibility outputs; no calculated value is persisted as an input' })
  calculate(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Request() req: any) {
    return mapDomainErrors(() => this.calculations.calculate(projectId, scenarioId, tenantFrom(req)))
  }

  @Post('scenarios/:scenarioId/sensitivity')
  @Roles(...FEASIBILITY_RUN_CALCULATIONS_ROLES)
  @ApiOperation({ summary: 'Run deterministic one- or two-variable sensitivity without changing scenario inputs' })
  sensitivity(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Body() dto: CreateSensitivityDto, @Request() req: any) {
    return mapDomainErrors(() => this.calculations.sensitivity(projectId, scenarioId, dto, tenantFrom(req)))
  }

  @Get('input-requirements')
  @ApiOperation({ summary: 'What this project type asks for, what has been answered, and what it deliberately does not ask' })
  inputRequirements(@Param('projectId') projectId: string, @Query('scenarioId') scenarioId: string | undefined, @Request() req: any) {
    return mapDomainErrors(() => this.calculations.inputRequirements(projectId, scenarioId ?? null, tenantFrom(req)))
  }

  @Post('scenarios/:scenarioId/financing/solve')
  @Roles(...FEASIBILITY_RUN_CALCULATIONS_ROLES)
  @ApiOperation({ summary: 'Solve the drawdown and repayment that satisfy the LTC covenant and close the debt balance; returns a schedule without writing one' })
  solveFinancing(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Body() dto: SolveFinancingDto, @Request() req: any) {
    return mapDomainErrors(() => this.calculations.solveFinancing(projectId, scenarioId, dto, tenantFrom(req)))
  }

  @Post('scenarios/:scenarioId/goal-seek')
  @Roles(...FEASIBILITY_RUN_CALCULATIONS_ROLES)
  @ApiOperation({ summary: 'Solve for the input that reaches a target metric; reports failure rather than inventing a reachable answer' })
  goalSeek(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Body() dto: CreateGoalSeekDto, @Request() req: any) {
    return mapDomainErrors(() => this.calculations.goalSeek(projectId, scenarioId, dto, tenantFrom(req)))
  }

  @Get('scenarios/:scenarioId/waterfall')
  @Roles(...FEASIBILITY_VIEW_ROLES)
  @ApiOperation({ summary: 'The equity waterfall: return of capital, preferred return and residual split per tranche, each with its own XIRR' })
  waterfall(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Request() req: any) {
    return mapDomainErrors(() => this.calculations.waterfall(projectId, scenarioId, tenantFrom(req)))
  }

  @Post('scenarios/:scenarioId/equity-tranches')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Add a layer of equity — terms only; its money stays in the cash-flow allocations' })
  addEquityTranche(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Body() dto: CreateEquityTrancheDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.addEquityTranche(projectId, scenarioId, dto, actorFrom(req)))
  }

  @Patch('scenarios/:scenarioId/equity-tranches/:trancheId')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  updateEquityTranche(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Param('trancheId') trancheId: string, @Body() dto: UpdateEquityTrancheDto, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.updateEquityTranche(projectId, scenarioId, trancheId, dto, actorFrom(req)))
  }

  @Delete('scenarios/:scenarioId/equity-tranches/:trancheId')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  deleteEquityTranche(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Param('trancheId') trancheId: string, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.deleteEquityTranche(projectId, scenarioId, trancheId, actorFrom(req)))
  }

  @Post('scenarios/:scenarioId/monte-carlo')
  @Roles(...FEASIBILITY_RUN_CALCULATIONS_ROLES)
  /*
   * A tighter throttle than the global one, because this is the only endpoint
   * in the module whose cost is set by the CALLER rather than by the data: a
   * single request may run the engine ten thousand times.
   *
   * This is not the access control — the role list above is — and it is not
   * the cost bound either; the endpoint's own measured budget guard refuses a
   * run it projects will exceed fifteen seconds. It is the third thing: a
   * limit on how often one authorised user can spend that budget, which
   * neither of the other two addresses.
   */
  @Throttle({ medium: { ttl: 60000, limit: 12 } })
  @ApiOperation({ summary: 'Run the engine over sampled inputs and return the distribution — P10/P50/P90, probability of loss and a histogram — rather than a single point estimate' })
  monteCarlo(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Body() dto: CreateMonteCarloDto, @Request() req: any) {
    return mapDomainErrors(() => this.calculations.monteCarlo(projectId, scenarioId, dto, tenantFrom(req)))
  }

  @Post('scenarios/:scenarioId/snapshots')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Freeze a reproducible calculation snapshot for a scenario' })
  createSnapshot(@Param('projectId') projectId: string, @Param('scenarioId') scenarioId: string, @Body() dto: CreateFeasibilitySnapshotDto, @Request() req: any) {
    return mapDomainErrors(() => this.calculations.createSnapshot(projectId, scenarioId, actorFrom(req), dto))
  }

  @Get('snapshots')
  @ApiOperation({ summary: 'List tenant-scoped immutable calculation snapshots' })
  listSnapshots(@Param('projectId') projectId: string, @Request() req: any) {
    return mapDomainErrors(() => this.calculations.listSnapshots(projectId, undefined, tenantFrom(req)))
  }

  @Get('compensation-candidates')
  @ApiOperation({ summary: 'List project-scoped ownership holdings for per-owner compensation; no national IDs are returned' })
  listCompensationCandidates(@Param('projectId') projectId: string, @Request() req: any) {
    return mapDomainErrors(() => this.feasibility.listCompensationCandidates(projectId, tenantFrom(req)))
  }

  @Get('reports')
  @ApiOperation({ summary: 'List immutable report versions for this project' })
  listReports(@Param('projectId') projectId: string, @Request() req: any) {
    return mapDomainErrors(() => this.reportVersions.list(projectId, tenantFrom(req)))
  }

  @Post('reports')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Create a draft report version from an immutable calculation snapshot' })
  createReport(@Param('projectId') projectId: string, @Body() dto: CreateFeasibilityReportVersionDto, @Request() req: any) {
    return mapDomainErrors(() => this.reportVersions.create(projectId, dto.snapshotId, dto.title, actorFrom(req)))
  }

  @Get('reports/:reportId')
  @ApiOperation({ summary: 'Read the immutable input, output and validation snapshots behind one report version' })
  findReport(@Param('projectId') projectId: string, @Param('reportId') reportId: string, @Request() req: any) {
    return mapDomainErrors(() => this.reportVersions.find(projectId, reportId, tenantFrom(req)))
  }

  @Post('reports/:reportId/export/excel')
  @Roles(...FEASIBILITY_EXPORT_ROLES)
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiOperation({ summary: 'Download an Excel workbook generated only from a locked report snapshot' })
  async exportExcel(@Param('projectId') projectId: string, @Param('reportId') reportId: string, @Request() req: any) {
    const result = await mapDomainErrors(() => this.excelExports.build(projectId, reportId, actorFrom(req)))
    return new StreamableFile(result.buffer, { disposition: `attachment; filename="${result.fileName}"`, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  }

  @Post('reports/:reportId/export/pdf')
  @Roles(...FEASIBILITY_EXPORT_ROLES)
  @Header('Content-Type', 'application/pdf')
  @ApiOperation({ summary: 'Download an RTL PDF generated only from a locked report snapshot' })
  async exportPdf(@Param('projectId') projectId: string, @Param('reportId') reportId: string, @Request() req: any) {
    const result = await mapDomainErrors(() => this.pdfExports.build(projectId, reportId, actorFrom(req)))
    return new StreamableFile(result.buffer, { disposition: `attachment; filename="${result.fileName}"`, type: 'application/pdf' })
  }

  @Patch('reports/:reportId/status')
  // The union of submit/approve/lock. Which of the three this caller may
  // actually perform depends on the TARGET state, which a route decorator
  // cannot see — so the service re-checks it. See FEASIBILITY_CAPABILITIES.
  @Roles(...FEASIBILITY_REPORT_TRANSITION_ROLES)
  @ApiOperation({ summary: 'Advance report version through review, approval and lock; locked reports are immutable' })
  transitionReport(@Param('projectId') projectId: string, @Param('reportId') reportId: string, @Body() dto: TransitionFeasibilityReportVersionDto, @Request() req: any) {
    return mapDomainErrors(() => this.reportVersions.transition(projectId, reportId, dto.status, actorFrom(req)))
  }
}
