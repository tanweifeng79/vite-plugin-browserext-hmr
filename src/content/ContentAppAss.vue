<template>
    <div>
      <transition name="el-fade-in-linear">
        <div>
          ggggwq12312
          <h1 class="text-red-610 text-[#f0f] text-2xl border border-red-800 border-solid border-2">ffff</h1>
          <el-button @click="handleClick">2313</el-button>
          <div class="i-mdi-alarm text-orange-400 w-211 h-141 hover:text-red-500 flex items-center justify-center" @click="handleClick" >button</div>
        </div>
      </transition> 
    </div>
  </template>
  
  <script setup lang="ts">
  import { ElButton,ElMessage } from "element-plus";
  
  const handleClick = () => {
    ElMessage.success("Hello World");
    console.log(123121111,ElMessage);
    
  };
  
  </script>

  
  <style scoped>
  </style>