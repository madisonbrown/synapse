FROM --platform=linux/amd64 node:14.17.3-alpine3.14

WORKDIR /usr/src/app

COPY ./ ./

RUN yarn install

EXPOSE 3000

CMD ["yarn", "start", "http"]
