FROM jupyter/notebook

COPY . /root/jupyter-nodejs
WORKDIR /root/jupyter-nodejs

RUN mkdir -p /root/.ipython/kernels/nodejs/
RUN npm install
RUN node install.js
RUN make

CMD sh -c 'jupyter notebook --NotebookApp.port=8888 --no-browser --ip=* --debug'

EXPOSE 8888
