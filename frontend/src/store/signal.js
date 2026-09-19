import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';
export const useSignalStore = defineStore('signal', () => {
    const loading = ref(false);
    const result = ref(null);
    const error = ref(null);
    const activeView = ref('spectrum');
    // 记录最近一次请求，失败后可原样重试
    let lastAction = null;
    function toErrorMessage(e) {
        if (axios.isAxiosError(e)) {
            const detail = e.response?.data?.detail;
            if (typeof detail === 'string' && detail)
                return `分析请求失败：${detail}`;
            if (e.response)
                return `分析请求失败：服务器返回 ${e.response.status}`;
            return '分析请求失败：无法连接后端服务，请确认服务已启动';
        }
        return `分析请求失败：${e instanceof Error ? e.message : '未知错误'}`;
    }
    async function run(action) {
        loading.value = true;
        error.value = null;
        lastAction = action;
        try {
            await action();
        }
        catch (e) {
            error.value = toErrorMessage(e);
        }
        finally {
            loading.value = false;
        }
    }
    async function analyze(params) {
        await run(async () => {
            const { data } = await axios.post('/api/generate', params);
            result.value = data;
        });
    }
    async function importCSV(formData) {
        await run(async () => {
            const { data } = await axios.post('/api/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            result.value = data;
        });
    }
    async function retry() {
        if (lastAction)
            await run(lastAction);
    }
    return { loading, result, error, activeView, analyze, importCSV, retry };
});
