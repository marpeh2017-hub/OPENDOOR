import { ApartmentDataQualityRule } from './apartment.rule'
import { BuildingDataQualityRule } from './building.rule'
import { CommunicationDataQualityRule } from './communication.rule'
import { DocumentDataQualityRule } from './document.rule'
import { DuplicateDataQualityRule } from './duplicate.rule'
import { FeasibilityDataQualityRule } from './feasibility.rule'
import { OwnerDataQualityRule } from './owner.rule'
import { OwnershipDataQualityRule } from './ownership.rule'
import { ProjectDataQualityRule } from './project.rule'
import { ResidentDataQualityRule } from './resident.rule'
import { SignatureDataQualityRule } from './signature.rule'
import { TaskDataQualityRule } from './task.rule'

export {
  ApartmentDataQualityRule,
  BuildingDataQualityRule,
  CommunicationDataQualityRule,
  DocumentDataQualityRule,
  DuplicateDataQualityRule,
  FeasibilityDataQualityRule,
  OwnerDataQualityRule,
  OwnershipDataQualityRule,
  ProjectDataQualityRule,
  ResidentDataQualityRule,
  SignatureDataQualityRule,
  TaskDataQualityRule,
}

/** Nest injection token for the ordered list of registered rules. */
export const DATA_QUALITY_RULES = 'DATA_QUALITY_RULES'

/**
 * Every rule class, in registration order. Adding a rule means adding it here
 * and to the module's providers — the engine needs no other change.
 */
export const RULE_PROVIDERS = [
  ProjectDataQualityRule,
  BuildingDataQualityRule,
  ApartmentDataQualityRule,
  OwnerDataQualityRule,
  OwnershipDataQualityRule,
  ResidentDataQualityRule,
  SignatureDataQualityRule,
  DocumentDataQualityRule,
  TaskDataQualityRule,
  CommunicationDataQualityRule,
  DuplicateDataQualityRule,
  FeasibilityDataQualityRule,
]
