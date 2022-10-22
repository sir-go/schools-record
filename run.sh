#!/bin/sh

PY=/venv/sch/bin/python2
DIR=/opt/sch/
DAEMON="${PY} ${DIR}runserver.py"
DAEMON_NAME=srec
DAEMON_LOG=/var/log/${DAEMON_NAME}.log

DAEMON_USER=root

PIDFILE=/var/run/${DAEMON_NAME}.pid

. /lib/lsb/init-functions

do_start () {
#    ${PREINIT}
    pkill ffmpeg
    log_daemon_msg "Starting system ${DAEMON_NAME} daemon"
    start-stop-daemon \
        --start --background \
        --pidfile ${PIDFILE} \
        --make-pidfile \
        --user ${DAEMON_USER} \
        --chuid ${DAEMON_USER} \
        --exec /bin/bash -- -c "exec $DAEMON >> ${DAEMON_LOG} 2>&1"
    log_end_msg $?
}
do_stop () {
    log_daemon_msg "Stopping system ${DAEMON_NAME} daemon"
    start-stop-daemon \
        --stop \
        --pidfile ${PIDFILE} \
        --retry 10
    log_end_msg $?
    pkill ffmpeg
}

case "${1}" in

    start|stop)
        do_${1}
    ;;

    restart|reload|force-reload)
        do_stop
        do_start
    ;;

    status)
        status_of_proc "${DAEMON_NAME}" "${DAEMON}" && exit 0 || exit $?
    ;;
    *)
        echo "Usage: /etc/init.d/${DAEMON_NAME} {start|stop|restart|status}"
        exit 1
    ;;

esac

exit 0
