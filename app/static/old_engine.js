/**
 * Created by mserg on 4/24/14.
 */
var
  $ = $,
  ip_regex = /^(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))\.(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))\.(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))\.(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))$/
;

$(document).ready(function () {

  if (! "WebSocket" in window) { console.error('browser does not support WebSockets'); return }

  var
    ws_uri = "ws://" + document.domain + ":" + (wsport || "5959") +"/ws",
    ws = {},
    faded = false,
    data = {
//      shared_settings: {},
      cams: [],
      cam_states: {},
      storages: []
    },
    cams_tmp = _.cloneDeep(data.cams),
    dom = {
      body: $('body'),
      modal_wait: $('#modal_wait'),
      cams_import: {
        form: $('#cams_import_form').find('.modal')
      },
      navbar: {
        btn_mass_run: $('#btn_mass_run'),
        btn_mass_stop: $('#btn_mass_stop'),
        storage_pads: {
          _place: $('#storage_pads_place'),
          _tmpl: $('#tmpl_storage_pads').html()
        },
        btn_settings: $('#btn_settings')
      },
      cam_pads: {
        _place: $('#cam_pads'),
        _tmpl: $('#tmpl_cam_pads').html()
      },
      cam_logs: {
        _place: $('#cam_log_place'),
        _tmpl: $('#tmpl_cam_logs').html()
      } ,
      settings: {
        _place: $('#frm_settings_place'),
        _tmpl: $('#tmpl_settings').html()
      }
    },
    all_are_started,
    all_are_stoped,
    some_started,
    some_stoped
  ;

  dom.cams_import.textarea = dom.cams_import.form.find('textarea');
  dom.cams_import.btn_ok = dom.cams_import.form.find('.btn-import-ok');

  function fade_page () {
    setTimeout(function () {
      if (!ws.ready && !faded) {
         dom.modal_wait.modal({'backdrop': 'static', 'keyboard': false});
         faded = true
      }
    }, 2000);
  }

  function modal_fix () {
//    dom.body.removeClass('modal-open');
//    $('.modal-backdrop').remove();
//    $('.modal-scrollable').remove();
  }

  function unfade_page () {
    if (faded) {
      dom.modal_wait.modal('hide');
      modal_fix();
      faded = false
    }
  }

  fade_page();

  function ws_connect () {
    ws = new WebSocket(ws_uri);
    ws.ready = false;
    ws.keep = true;
    ws.send_msg = function (msg) {
      if (ws.ready) {
        ws.send(msg)
      }
    };
    ws.onopen = function () {
      ws.ready = true;
      unfade_page();
      rpc_call('get_cams');
      rpc_call('storages_update');
      rpc_call('states_update');
//      timers.storages_renew = setInterval(function () {rpc_call('get_storages')}, 2000)
    };
    ws.onclose = function (event) {
      ws.ready = false;
//      clearInterval(timers.storages_renew);
      if (ws.keep) {
        fade_page();
        setTimeout(ws_connect, 250);
      }
    };
    ws.onmessage = function (msg) {
      var message = JSON.parse(msg.data);
//      console.debug(message);
      switch (message.type) {
        case 'rpc':
          switch (message.method) {

            case 'get_cams':
            case 'edit_cams':
              data.cams = message.response;
              $.each(data.cams, function (idx, cam) {
                delete data.cam_states[cam.uid];
              });
              cams_renew();
              rpc_call('states_update');
              break;

            case 'states_update':
              states_renew(message.response);
              console.debug(message);
              break;

//            case 'get_settings':
//              $.each(message.response, function (idx, itm) {
//                data.shared_settings[itm.key] = itm.val
//              });
//              break;

            case 'storage_detach':
            case 'storages_update':
              data.storages = message.response;
              storages_renew();
              break;

          }
          break;

        case 'notice':
          switch (message.event) {

            case 'storages_changed':
              data.storages = message.attach;
              storages_renew();
              break;

            case 'state_changed':
              var pobj = {};
              pobj[message.sender] = message.attach;
              console.debug(message);
              states_renew(pobj);
              break;

            case 'cams_changed':
              data.cams = message.attach;
              cams_renew();
              break;

            default :
//              console.debug(message);
              break;
          }
          break;

        case 'error':
          //
          break;
      }
    };
  }
  ws_connect();

  function rpc_call (method, params) {
    if (!ws.ready) {return}
    console.debug({'type': 'rpc', 'method': method, 'params': params});
    ws.send(JSON.stringify({type: "rpc", method: method, params: params}));
  }

  function cams_renew () {
    dom.cam_pads._place.html(
      _.template(dom.cam_pads._tmpl,{cams: data.cams})
    );
  }

  function find_dev_pad (stor_mp) {
    return $('.dev-pad[data-stor-mp="' + stor_mp + '"]')
  }

  function find_cam_pad (cam_uid) {
    return $('.campad[data-cam-uid="' + cam_uid + '"]')
  }


  function campad_btn_busy (btn, state) {
    var icon = btn.find('.glyphicon');
    if (!state) {
      btn.removeClass('active').prop('disabled', false);
      icon.removeClass('glyphicon-stop').addClass('glyphicon-record');
    } else {
      btn.addClass('active');
      icon.removeClass('glyphicon-record').addClass('glyphicon-stop');
    }
  }

  function states_renew (states_obj) {
    $.each(states_obj, function (c_uid, c_state) {
      var
        campad = find_cam_pad(c_uid),
        btn = campad.find('.btn-campad-act'),
        info_stat_link = campad.find('.cam-log-link'),

        current_command = c_state.current_command,
        control_state = c_state.control_state,
        state = c_state.state,
        state_info = c_state.state_info
      ;
      data.cam_states[c_uid] = c_state;
/*
      current_command: 'run | stop | new_file | quit'
      cut_time: null
      destinations: Array[0]
      started_time: null
      state: "stopped | launch | running | error | stopping"
*/
//      console.debug(c_uid, current_command, state, control_state, c_state.codepart);

      campad_btn_busy(btn, control_state != 'ready');
      info_stat_link.text(state_info);

      var st_info_style = '#FFFFFF';
      switch (state_info) {
        case 'готов':
          st_info_style = '#DDFAE0';
          break;
        case 'остановка записи...':
        case 'старт записи...':
          st_info_style = '#FFFDE7';
          break;
        case 'ошибка, рестарт записи...':
          st_info_style = '#FFD0D0';
          break;
        default :
          st_info_style = '#E7F5FF';
          break;
      }
      info_stat_link.css('background-color', st_info_style);

    });

    all_are_started = _.all(data.cam_states, function (st) {return st.control_state != 'ready'});
    all_are_stoped = _.all(data.cam_states, function (st) {return st.control_state == 'ready'});

    some_started = _.some(data.cam_states, function (st) {return st.control_state != 'ready'});
    some_stoped = _.some(data.cam_states, function (st) {return st.control_state == 'ready'});

    dom.navbar.btn_settings.prop('disabled', !all_are_stoped);
    $('.btn-detach-ext').prop('disabled', !all_are_stoped);
    dom.navbar.btn_mass_run.prop('disabled', !some_stoped);
    dom.navbar.btn_mass_stop.prop('disabled', !some_started);

  }

  function storages_renew () {
    var
      showed_popover = $('.popover'),
      showed_popover_stor = showed_popover.find('.table-in-popover').attr('data-stor-mp')
    ;
    find_dev_pad(showed_popover_stor).popover('destroy');
    dom.navbar.storage_pads._place.html(
      _.template(dom.navbar.storage_pads._tmpl,{
        storages_int: _.filter(data.storages, function (storage) {return !storage.ext && storage.mounted}),
        storages_ext: _.filter(data.storages, function (storage) {return storage.ext && storage.mounted})
      })
    );
    $('.dev-pad').popover({trigger: 'hover', container: '.toolbar', placement: 'bottom', animation: false});
    find_dev_pad(showed_popover_stor).popover('show');
    $('.btn-detach-ext').prop('disabled', !all_are_stoped);
  }

  $.fn.detach_storage = function (mp) {
    rpc_call('storage_detach', {mp: mp})
  };

  dom.body
    .on('mouseenter', '.dev-pad',
      function () {
        $(this).popover('show')
      })
    .on('mouseleave', '.dev-pad',
      function () {
        $(this).popover('hide')
      })
    .on('click', '.dev-pad',
      function () {
        var
          stor_mp = $(this).attr('data-stor-mp')
//          ,
//          _date = new Date(),
//          dd = _date.getDate(),
//          mm = _date.getMonth()+ 1, //January is 0!
//          yyyy = _date.getFullYear()
        ;
//        if(dd<10) {dd='0'+dd}
//        if(mm<10) {mm='0'+mm}
//
//        var today = yyyy+'-'+mm+'-'+dd;

//        window.open('ftp://' + window.location.hostname + '/' + stor_mp + '/' + today, 'Видеозаписи на: ' + stor_mp, {width: 800, height: 500});
        window.open('/records/' + stor_mp, 'Видеозаписи на: ' + stor_mp, {width: 800, height: 500});
      }
    )
    .on('click', '.act_btn',
      function () {
        var
            me = $(this),
            my_channel = me.closest('tr')[0],
            my_action = me.attr('data-act')
        ;
        rpc_call('ch_action', {
          action: my_action,
          cid: _.isUndefined(my_channel) ? null : $(my_channel).attr('data-cam-uid')
        })
      }
    )
  .on('click', '.cam-log-link',
      function () {
        var
          me = this,
          my_cam_uid = $(me).closest('.campad').attr('data-cam-uid')
        ;
//        show_logs(my_cam_uid);
    }
  )
  .on('click', '.btn-campad-act',
      function () {
        var
          me = $(this),
          my_pad = me.closest('.campad'),
          my_cam_uid = my_pad.attr('data-cam-uid'),
          my_action = me.hasClass('active') ? 'stop' : 'run'
        ;
        cam_act(my_action, my_cam_uid);
    }
  );

  function cams_get_by_uid (uid) {
    return _.find(cams_tmp, function (cam) {return cam.uid == uid})
  }

  function settings_frm_remap () {
    dom.settings.map = {
      select: $('#cams_list_select').find('select'),
      cams_frm: $('#cams_settings_place').find('form'),
      btn_apply: $('.settings-apply'),
      btn_del: $('.btn-cam-del'),
      btn_add: $('.btn-cam-add'),
      btn_import: $('.btn-cam-import')
    };
    dom.settings.map.cams_frm.fields = {
      alias: dom.settings.map.cams_frm.find('input[name="alias"]'),
      ip: dom.settings.map.cams_frm.find('input[name="ip"]'),
      uri: dom.settings.map.cams_frm.find('input[name="uri"]'),
      user: dom.settings.map.cams_frm.find('input[name="user"]'),
      pwd: dom.settings.map.cams_frm.find('input[name="pwd"]')
    }
  }

  function check_changes () {
    var eq = !_.isEqual(cams_tmp, data.cams);
    dom.settings.map.btn_apply.toggleClass('hide', !eq);
    return eq
  }

  function check_valid () {
    var errors = {}, result = '';
    _(cams_tmp).forEach(function (cam) {
      errors[cam.uid] = {'alias': cam.alias, 'wrongs': []};
      if (_.isEmpty(cam.alias)) { errors[cam.uid].wrongs.push('\tназвание обязательно') }
      if (_.isEmpty(cam.uri)) { errors[cam.uid].wrongs.push('\turi ресурса обязателен') }
      if (!cam.ip.match(ip_regex)) { errors[cam.uid].wrongs.push('\tне корректен ip') }
      _(cams_tmp).forEach(function (dbl_cam) {
        if (cam !== dbl_cam) {
          if (cam.alias == dbl_cam.alias) { errors[cam.uid].wrongs.push('\tесть дубликаты по названию') }
          if (cam.ip == dbl_cam.ip) { errors[cam.uid].wrongs.push('\tесть дубликаты по ip') }
        }
      });
    });

    _.forEach(errors, function (err, uid) {
      if (!_.isEmpty(err.wrongs)) {
        result += '"' + err.alias + '":\n' + err.wrongs.join('\n') + '\n'
      }
    });

    if (!_.isEmpty(result)) {
      alert(result);
      return false;
    } else {
      return true
    }
  }

  function get_changes (orig_arr, new_arr, key_field) {
    var
      changes = {add:[], del:[], change: {}},
      changed_obj,
      checked = []
    ;
    _(new_arr).forEach(function (new_itm) {
      var orig_itm = _.find(orig_arr, function (i) {return i[key_field] == new_itm[key_field]});
        if (_.isUndefined(orig_itm)) {      // not found
          changes.add.push(new_itm)
        } else {                            // found
          checked.push(new_itm[key_field]);
          if (! _.isEqual(orig_itm, new_itm)) {           // not equals
            changes.change[new_itm[key_field]] = {};
            _(                                          // search different attributes
              _.filter(_.keys(orig_itm), function (k) {return !_.isEqual(orig_itm[k], new_itm[k])})
            ).forEach(function (_k) {
              changes.change[orig_itm[key_field]][_k] = new_itm[_k]
            })
          }
        }
    });
    _(orig_arr).forEach(function (orig_itm) {
      if (!_.contains(checked, orig_itm[key_field])) {
        changes.del.push(orig_itm[key_field])
      }
    });
    return changes;
  }

  function select_first_cam () {
    var first_option = dom.settings.map.select.find('option:first');
    dom.settings.map.select.val(first_option.val()).change();
  }

  function select_last_cam () {
    var last_option = dom.settings.map.select.find('option:last');
    dom.settings.map.select.val(last_option.val()).change();
  }

  function add_cam (cam_conf) {
    var
      uid = (Math.floor(Math.random() * Math.pow(10,10)) + 1).toString(16),
      _conf = cam_conf || {alias: null, ip: null, uri: null, user: null, pwd: null},
      new_cam = {
        uid   : 'uid_' + uid,
        alias : _conf.alias  || 'новая камера ' + uid,
        ip    : _conf.ip     || '',
        uri   : _conf.uri    || '',
        user  : _conf.user   || '',
        pwd   : _conf.pwd    || ''
      }
    ;
    cams_tmp.push(new_cam);
    dom.settings.map.select.append($('<option value="' + new_cam.uid + '">' + new_cam.alias + '</option>'));
    select_last_cam();
    check_changes();
  }

  function settings_binds () {
    settings_frm_remap();
    var selected_cam;

    dom.settings.map.select.on({
      change: function (e) {
//        if (cam_uid.length > 1) {
//          dom.settings.map.cams_frm.find('input')
//            .val('')
//            .prop('disabled', true)
//          ;
//        } else {
          selected_cam = cams_get_by_uid($(this).val());
//          dom.settings.map.cams_frm.find('input').prop('disabled', false);
        if (selected_cam) {
          $.each(dom.settings.map.cams_frm.fields, function (name, el) { $(el).val(selected_cam[name]); });
        }
//        }
      }
    });

    dom.settings.map.cams_frm.find('input').on({
      keyup: function () {
        var
          me = $(this),
          my_name = me.attr('name')
        ;
        if (my_name == 'alias') {
          dom.settings.map.select.find('option:selected').text(me.val());
        }
        selected_cam[my_name] = me.val();
        check_changes();
      },
      change: function () {
        var
          me = $(this),
          my_name = me.attr('name')
        ;
        if (my_name == 'alias') {
          dom.settings.map.select.find('option:selected').text(me.val());
        }
        selected_cam[my_name] = me.val();
        check_changes();
      }
    });

    dom.settings.map.btn_apply.on({
      click: function () {
        if (check_changes() && check_valid()) {
          rpc_call('edit_cams', {changes: get_changes(data.cams, cams_tmp, 'uid')});
          dom.settings._form.modal('hide');
          modal_fix();
        }
      }
    });

    dom.settings.map.btn_del.on({
      click: function () {
        _.remove(cams_tmp, function (cam) {return cam.uid == selected_cam.uid});
        dom.settings.map.select.find('option:selected').remove();
        select_first_cam();
        check_changes();
      }
    });

    dom.settings.map.btn_add.click(function () {
      add_cam()
    });

    dom.settings.map.btn_import.on({
      click: function () {
        dom.cams_import.textarea.val('');
        dom.cams_import.form.modal({width: 900});
      }
    });

    select_first_cam();
  }

  dom.cams_import.btn_ok.on({
    click: function () {
      var
        raw = dom.cams_import.textarea.val().split(/\n|\r/),
        has_errors = false,
        obj_list = []
      ;
      $.each(raw, function (idx, cam_str) {
        var _str = cam_str.trim().replace(/(^,)|(,$)/g, "");
        try {
          obj_list.push(JSON.parse(_str))
        } catch (err) {
            if (err.name == 'SyntaxError') {
              console.error(err);
              has_errors = true;
            }
        }
        console.log(obj_list);
      });
      if (!has_errors) {
        $.each(obj_list, function (idx, obj) {add_cam(obj)});
        dom.cams_import.form.modal('hide');
        modal_fix();
      } else {
        alert(
          'синтаксические ошибки в списке: \n' +
            '\tjson - объекты в формате:\n' +
            '\t{"ключ": "значение"} через запятую'
        );
      }

    }
  });

  function cam_act (act, cam_uid) {
    rpc_call('ch_action', {
      action: act,
      cid: cam_uid || null
    });
  }

  dom.navbar.btn_mass_run.on({
    click: function () {
//      var timeout = 500;
//      $.each(data.cams, function (idx, cam) {
//        setTimeout(function () {
//           cam_act('run', cam.uid)
//        }, timeout * idx + 1)
//
//      });
      cam_act('run');
    }
  });

  dom.navbar.btn_mass_stop.on({
    click: function () {
//      var timeout = 10;
//      $.each(data.cams, function (idx, cam) {
//        setTimeout(function () {
//          cam_act('stop', cam.uid)
//        }, timeout * idx + 1)
//      });
      cam_act('stop')
    }
  });

  function show_settings () {
    cams_tmp = _.cloneDeep(data.cams);
    dom.settings._place.html(_.template(dom.settings._tmpl, {cams: cams_tmp /*, settings: data.shared_settings */}));
    dom.settings._form = dom.settings._place.find('.modal');
    dom.settings._form.modal({'backdrop': 'static', 'width': 900});
    settings_binds();
  }

  function show_logs (cam_uid) {
    dom.cam_logs._place.html(
        _.template(dom.cam_logs._tmpl, {cam: _.find(data.cams, function (itm) {return itm.uid == cam_uid})})
      );
    dom.cam_logs._form = dom.cam_logs._place.find('.modal');
    dom.cam_logs._form.modal();
  }

  dom.navbar.btn_settings.on({
    'click': show_settings
  });

  window.onbeforeunload = function () {
    ws.keep = false;
    ws.close();
  };

});
