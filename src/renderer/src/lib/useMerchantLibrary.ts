import { useCallback, useEffect, useState } from 'react'
import type { MerchantCreate, MerchantRecord, MerchantUpdate } from '../../../shared/merchants'

interface MerchantLibraryState {
  records: MerchantRecord[]
  isLoading: boolean
  isRescanning: boolean
  error?: string
  status?: string
}

export interface MerchantLibraryController extends MerchantLibraryState {
  approve: (id: string) => void
  exclude: (id: string) => void
  restore: (id: string) => void
  toggleForecast: (id: string, included: boolean) => void
  update: (id: string, update: MerchantUpdate) => void
  forget: (id: string) => void
  create: (input: MerchantCreate) => void
  mergeAlias: (targetId: string, alias: string) => void
  rescanProject: (projectId: string) => void
}

function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function useMerchantLibrary(): MerchantLibraryController {
  const [state, setState] = useState<MerchantLibraryState>({
    records: [],
    isLoading: true,
    isRescanning: false
  })

  const refresh = useCallback(async (status?: string): Promise<void> => {
    try {
      const records = await window.studio.merchants.list()
      setState((current) => ({ ...current, records, isLoading: false, error: undefined, status }))
    } catch (error) {
      setState((current) => ({
        ...current,
        isLoading: false,
        error: messageFor(error, 'Unable to read the merchant library.')
      }))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const run = useCallback(
    (action: () => Promise<unknown>, status: string, failure: string): void => {
      void action()
        .then(() => refresh(status))
        .catch((error: unknown) =>
          setState((current) => ({ ...current, error: messageFor(error, failure) }))
        )
    },
    [refresh]
  )

  const update = useCallback(
    (id: string, patch: MerchantUpdate): void => {
      run(
        () => window.studio.merchants.update(id, patch),
        'Merchant updated.',
        'Unable to update this merchant.'
      )
    },
    [run]
  )

  const mergeAlias = useCallback(
    (targetId: string, alias: string): void => {
      const target = state.records.find((record) => record.id === targetId)
      if (!target) return
      update(targetId, { aliases: [...target.aliases, alias] })
    },
    [state.records, update]
  )

  const rescanProject = useCallback(
    (projectId: string): void => {
      setState((current) => ({ ...current, isRescanning: true, error: undefined }))
      void window.studio.merchants
        .rescanProject(projectId)
        .then((result) =>
          refresh(
            `Rescan complete: ${result.added} new, ${result.flaggedPersonal} flagged as private. Your decisions were kept.`
          )
        )
        .catch((error: unknown) =>
          setState((current) => ({
            ...current,
            error: messageFor(error, 'Unable to rescan this project.')
          }))
        )
        .finally(() => setState((current) => ({ ...current, isRescanning: false })))
    },
    [refresh]
  )

  return {
    ...state,
    update,
    mergeAlias,
    rescanProject,
    approve: useCallback(
      (id: string) => update(id, { classification: 'merchant-candidate' }),
      [update]
    ),
    exclude: useCallback(
      (id: string) => update(id, { classification: 'excluded', forecastIncluded: false }),
      [update]
    ),
    restore: useCallback(
      (id: string) => update(id, { classification: 'merchant-candidate' }),
      [update]
    ),
    toggleForecast: useCallback(
      (id: string, included: boolean) => update(id, { forecastIncluded: included }),
      [update]
    ),
    forget: useCallback(
      (id: string) =>
        run(
          () => window.studio.merchants.remove(id),
          'Merchant forgotten. Project entries were not changed.',
          'Unable to forget this merchant.'
        ),
      [run]
    ),
    create: useCallback(
      (input: MerchantCreate) =>
        run(
          () => window.studio.merchants.create(input),
          'Merchant added.',
          'Unable to add this merchant.'
        ),
      [run]
    )
  }
}
