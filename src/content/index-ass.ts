import {
  createApp,
  //   createVaporApp,
  //   vaporInteropPlugin,
  //   defineAsyncComponent,
} from "vue";
import "../style/base.css";
// import ElementPlus from "element-plus";
import ContentAppAss from "./ContentAppAss.vue";
import "element-plus/dist/index.css";
// import "uno.css";

const cpnentDiv = document.createElement("div");
cpnentDiv.id = "nentDivApp";
cpnentDiv.style.cssText = `
position: fixed; 
top: 200px; 
left: 0;
z-index: 999;
`;
document.body.appendChild(cpnentDiv);
console.log(1113);

createApp(ContentAppAss).mount("#nentDivApp");
// createVaporApp(ContentApp).use(vaporInteropPlugin).mount("#cpnentDivApp");
// createApp(ContentApp).use(ElementPlus).mount("#cpnentDivApp");
