<template>
  <div ref="el" class="line-chart"></div>
</template>

<script setup>
// 通用折线图（ECharts 封装）：体重曲线 / 奶量曲线共用
// 按需引入，控制打包体积：只注册折线图 + 网格 + 提示框
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

const props = defineProps({
  // [{ date: 'YYYY-MM-DD', value: Number }]
  points: { type: Array, default: () => [] },
  color: { type: String, default: '#1677ff' },
  unit: { type: String, default: '' },
});

const el = ref(null);
let chart = null;
let ro = null;

function render() {
  if (!chart) return;
  const pts = (props.points || []).filter((p) => p.value != null);
  chart.setOption(
    {
      animation: false,
      grid: { left: 38, right: 18, top: 22, bottom: 24 },
      tooltip: {
        trigger: 'axis',
        confine: true,
        formatter: (params) => {
          const p = params?.[0];
          return p ? `${p.axisValue}<br/>${p.data}${props.unit}` : '';
        },
      },
      xAxis: {
        type: 'category',
        boundaryGap: true, // 两端留边距，首尾点的数值标签不会贴边
        data: pts.map((p) => p.date),
        axisLabel: {
          fontSize: 11,
          color: '#969799',
          formatter: (v) => v.slice(5), // MM-DD
        },
        axisLine: { lineStyle: { color: '#eef0f3' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: true, // 不从 0 起，看趋势
        splitLine: { lineStyle: { color: '#eef0f3' } },
        axisLabel: { fontSize: 10, color: '#969799' },
      },
      series: [
        {
          type: 'line',
          data: pts.map((p) => p.value),
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: props.color, width: 2 },
          itemStyle: { color: props.color, borderColor: '#fff', borderWidth: 2 },
          // 节点上方常显数值
          label: {
            show: true,
            position: 'top',
            fontSize: 10,
            fontWeight: 600,
            color: props.color,
          },
        },
      ],
    },
    { notMerge: true }
  );
}

onMounted(() => {
  chart = echarts.init(el.value);
  render();
  // 容器尺寸变化（周期切换/屏幕旋转）自动重绘
  ro = new ResizeObserver(() => chart && chart.resize());
  ro.observe(el.value);
});

watch(() => props.points, render, { deep: true });

onBeforeUnmount(() => {
  if (ro) ro.disconnect();
  if (chart) chart.dispose();
  chart = null;
});
</script>

<style scoped>
.line-chart {
  width: 100%;
  height: 160px;
}
</style>
