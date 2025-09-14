FROM node:lts as builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

FROM nginx:alpine

RUN mkdir -p /usr/share/nginx/html/Mud-return
COPY --from=builder /app/dist /usr/share/nginx/html/Mud-return
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
