FROM jupyter/base-notebook
#my objective would be to get it to work on top of this one instead,
# but for now let's keep it simple
#FROM jupyter/scipy-notebook:latest

USER root
# need gnupg2 to run node setup
RUN apt-get update && apt-get install -y nodejs g++ make software-properties-common libzmq3-dev gnupg2
# upgraded to latest supported version
RUN wget -O - https://deb.nodesource.com/setup_10.x | bash

# this probably is not helpful, I just gave it a try in the hope it would clear up the issues a little
RUN conda update -n base conda

RUN mkdir -p $HOME/jupyter-nodejs
COPY . $HOME/jupyter-nodejs
RUN chown -R $NB_USER $HOME/jupyter-nodejs
WORKDIR $HOME/jupyter-nodejs
RUN touch /etc/ld.so.conf
RUN echo "/opt/conda/lib" >> /etc/ld.so.conf

# RUN add-apt-repository ppa:chris-lea/zeromq -y
# RUN add-apt-repository ppa:chris-lea/libpgm -y
# RUN apt-get update
RUN conda install -y jupyter_console

USER $NB_USER
RUN mkdir -p $HOME/.ipython/kernels/nodejs/
RUN npm install
RUN node install.js
RUN npm run build
RUN npm run build-ext
WORKDIR $HOME/jupyter-nodejs/node_modules/zmq/
RUN npm run install

USER root
WORKDIR $HOME/jupyter-nodejs
RUN ldconfig

EXPOSE 8888
