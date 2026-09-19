import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import type { AnalysisResult } from '@/types'

type LastRequest =
  | { kind: 'generate'; params: { modulation: string; samples: number; snr: number } }
  | { kind: 'import'; formData: FormData }

export const useSignalStore = defineStore('signal', () => {
  const loading = ref(false)
  const result = ref<AnalysisResult | null>(null)
  const error = ref<string | null>(null)
  const activeView = ref('spectrum')
  const lastRequest = ref<LastRequest | null>(null)

  function toErrorMessage(e: unknown): string {
    if (axios.isAxiosError(e)) {
      const detail = (e.response?.data as { detail?: unknown } | undefined)?.detail
      if (typeof detail === 'string' && detail) return `分析失败：${detail}`
      if (e.response) return `分析失败：服务器返回错误 (${e.response.status})`
      return '分析失败：无法连接服务器，请确认后端服务已启动'
    }
    return `分析失败：${(e as Error)?.message || '未知错误'}`
  }

  async function analyze(params: { modulation: string; samples: number; snr: number }) {
    loading.value = true
    error.value = null
    lastRequest.value = { kind: 'generate', params: { ...params } }
    try {
      const { data } = await axios.post('/api/generate', params)
      result.value = data
    } catch (e) {
      error.value = toErrorMessage(e)
    } finally { loading.value = false }
  }

  async function importCSV(formData: FormData) {
    loading.value = true
    error.value = null
    lastRequest.value = { kind: 'import', formData }
    try {
      const { data } = await axios.post('/api/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      result.value = data
    } catch (e) {
      error.value = toErrorMessage(e)
    } finally { loading.value = false }
  }

  async function retry() {
    const req = lastRequest.value
    if (!req) return
    if (req.kind === 'generate') await analyze(req.params)
    else await importCSV(req.formData)
  }

  return { loading, result, error, activeView, analyze, importCSV, retry }
})
