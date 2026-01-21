'use client';

import React from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface RadarChartProps {
  data: number[];
  labels: string[];
}

export const RadarChart = ({ data, labels }: RadarChartProps) => {
  const chartData = {
    labels: labels,
    datasets: [
      {
        label: '学生表现',
        data: data,
        backgroundColor: 'rgba(255, 224, 102, 0.3)',
        borderColor: '#ffe066',
        borderWidth: 2,
        pointBackgroundColor: '#ffe066',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#ffe066',
      },
    ],
  };

  const options = {
    scales: {
      r: {
        angleLines: { color: '#28392f' },
        grid: { color: '#28392f' },
        pointLabels: {
          color: '#fff',
          font: { size: 14, family: "'Spline Sans', sans-serif" },
        },
        min: 0,
        max: 25,
        ticks: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
    },
    responsive: true,
    maintainAspectRatio: false,
  };

  return <Radar data={chartData} options={options} />;
};
