<template>
  <div>
    <!-- <AA></AA> -->
    <h1 class="text-red-500 bg-blue-500 border border-red-500 border-solid border-2">55555111</h1>
    <button @click="count++">+22555</button>
    <button @click="count--">-</button>
    <p>{{ count }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
// import AA from './AA.vue'

const count = ref(0);
</script>

<style scoped>
h1 {
  color: red;
}
</style>