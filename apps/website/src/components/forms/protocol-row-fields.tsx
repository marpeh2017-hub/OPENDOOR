'use client'

import { useTranslations } from 'next-intl'
import { Checkbox, Field, FieldDescription, FieldLabel, Input } from '@urban-renewal/ui'
import { isValidEmail, isValidPhone } from '@/lib/validation'
import { isValidIsraeliId } from '@/lib/public-forms'
import { CONTACT } from '@/lib/site-config'
import { SignaturePad } from './signature-pad'

export interface RowValues {
  apartmentNumber: string
  fullName: string
  idNumber: string
  phone: string
  email: string
}

export const EMPTY_ROW: RowValues = { apartmentNumber: '', fullName: '', idNumber: '', phone: '', email: '' }

/** Each problem as the message the field shows. */
export type RowErrors = Partial<Record<keyof RowValues | 'signature' | 'confirmRead', string>>

type T = (key: string) => string

/** The row's problems, in the page's language; empty when it can be signed. */
export function rowErrors(
  t: T,
  tForms: T,
  values: RowValues,
  signature: string | null,
  confirmRead: boolean,
  phoneRequired: boolean,
): RowErrors {
  const errors: RowErrors = {}
  if (!values.apartmentNumber.trim()) errors.apartmentNumber = t('apartmentRequired')
  if (values.fullName.trim().length < 2) errors.fullName = tForms('errors.nameRequired')
  if (!isValidIsraeliId(values.idNumber)) errors.idNumber = t('idInvalid')
  const phone = values.phone.trim()
  if (phoneRequired && !phone) errors.phone = tForms('errors.phoneRequired')
  else if (phone && !isValidPhone(phone)) errors.phone = tForms('errors.phoneInvalid')
  if (values.email.trim() && !isValidEmail(values.email.trim())) errors.email = tForms('errors.emailInvalid')
  if (!signature) errors.signature = t('signatureRequired')
  if (!confirmRead) errors.confirmRead = t('confirmRequired')
  return errors
}

/**
 * One row of the protocol's owners' table, as a signer fills it in on the
 * website: apartment, name, ID number (its check digit checked as they type),
 * phone and email, a drawn signature, and the reading confirmation. Used by
 * the initiator (phone required: we call them back) and by each neighbour.
 */
export function ProtocolRowFields({
  idPrefix,
  values,
  onChange,
  onSignature,
  confirmRead,
  onConfirmRead,
  phoneRequired,
  errors,
}: {
  idPrefix: string
  values: RowValues
  onChange: (next: RowValues) => void
  onSignature: (dataUrl: string | null) => void
  confirmRead: boolean
  onConfirmRead: (next: boolean) => void
  phoneRequired: boolean
  errors: RowErrors
}) {
  const t = useTranslations('pages.forms')
  const tForms = useTranslations('forms')
  const set = (key: keyof RowValues, value: string) => onChange({ ...values, [key]: value })
  const idTyped = values.idNumber.replace(/\D/g, '').length >= 5
  const idWrong = idTyped && !isValidIsraeliId(values.idNumber)

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <Field id={`${idPrefix}-apartment`} required error={errors.apartmentNumber}>
          <FieldLabel requiredLabel={tForms('required')}>{t('apartment')}</FieldLabel>
          <Input
            controlSize="comfortable"
            inputMode="numeric"
            maxLength={10}
            value={values.apartmentNumber}
            onChange={(e) => set('apartmentNumber', e.target.value)}
          />
        </Field>
        <Field id={`${idPrefix}-name`} required error={errors.fullName}>
          <FieldLabel requiredLabel={tForms('required')}>{t('fullName')}</FieldLabel>
          <Input
            controlSize="comfortable"
            autoComplete="name"
            maxLength={80}
            value={values.fullName}
            onChange={(e) => set('fullName', e.target.value)}
          />
        </Field>
      </div>

      <Field id={`${idPrefix}-id`} required error={errors.idNumber || (idWrong ? t('idInvalid') : null)}>
        <FieldLabel requiredLabel={tForms('required')}>{t('idNumber')}</FieldLabel>
        <FieldDescription>{t('idHint')}</FieldDescription>
        <Input
          controlSize="comfortable"
          inputMode="numeric"
          dir="ltr"
          maxLength={9}
          value={values.idNumber}
          onChange={(e) => set('idNumber', e.target.value.replace(/\D/g, '').slice(0, 9))}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${idPrefix}-phone`} required={phoneRequired} error={errors.phone}>
          <FieldLabel requiredLabel={tForms('required')}>
            {t('phone')}
            {!phoneRequired && <span className="ms-1 font-normal text-gray-600">({t('optional')})</span>}
          </FieldLabel>
          <Input
            controlSize="comfortable"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            value={values.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
        </Field>
        <Field id={`${idPrefix}-email`} error={errors.email}>
          <FieldLabel>
            {t('email')}
            <span className="ms-1 font-normal text-gray-600">({t('optional')})</span>
          </FieldLabel>
          <Input
            controlSize="comfortable"
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </Field>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-signature`} className="block text-sm font-medium text-gray-800">
          {t('signature')}
          <span aria-hidden="true" className="ms-1 text-red-600">*</span>
        </label>
        <SignaturePad id={`${idPrefix}-signature`} describedBy={`${idPrefix}-signature-help`} onChange={onSignature} />
        <p id={`${idPrefix}-signature-help`} className="text-xs text-gray-600">
          {t('signatureHelp', { phone: CONTACT.phone })}
        </p>
        {errors.signature && (
          <p role="alert" className="text-sm text-red-700">
            {errors.signature}
          </p>
        )}
      </div>

      <Checkbox
        id={`${idPrefix}-confirm`}
        checked={confirmRead}
        onCheckedChange={(next) => onConfirmRead(next === true)}
        error={errors.confirmRead}
        label={t('confirmRead')}
      />
    </div>
  )
}
