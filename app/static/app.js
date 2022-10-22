var
  $ = $,
  ip_regex = /^(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))\.(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))\.(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))\.(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))$/,
  ws_died = 0
;

$(document).ready(function () {
  var
    global_debug = true,
    wsport = document.ws_port || 80,
    ws_uri = "ws://" + document.domain + ":" + wsport +"/ws",
    faded = false,
    ws = new $.JsonRpcClient({ajaxUrl: '', socketUrl: ws_uri,
      onerror: function () {
        if (global_debug) console.error('ws_error');
        if (ws_died > 999) ws_died = 100;
        if (ws_died) fade();
        ws_died++;
      },
      onopen: function () {
        if (global_debug) console.debug('ws_open');
        ws_died = 0;
        unfade()
      }
    }),

    state = {
      'storages': [],
      'cameras': {},
      'cam_states': {}
    },
    cams_tmp = _.cloneDeep(state.cameras),
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
    all_mass_started,
    some_started,
    some_stoped
  ;
  dom.cams_import.textarea = dom.cams_import.form.find('textarea');
  dom.cams_import.btn_ok = dom.cams_import.form.find('.btn-import-ok');

  function rpc_call (method, params, success, error) {
    ws.call(method, params,

      function success_cb (resp) {
        ws_died = 0;
        unfade();
//        if (global_debug) console.debug('ws in : ', resp);
        if (typeof success === 'function') success(resp);
      },

      function error_cb (resp) {
        if (global_debug) console.error('ws err: ', resp);
         if (typeof error === 'function') error(resp);
      },

      function before_call_cb (req) {
//        if (global_debug) console.debug('ws out: ', req)
      }
    )
  }


  function start_get_state_loop () {
    setInterval(function () {
      rpc_call('get_state', null, state_renew);
    }, 250);
  }

  function fade () {
    if (!faded) {
      dom.modal_wait.modal({'backdrop': 'static', 'keyboard': false});
      faded = true
    }
  }

  function unfade () {
    if (faded) {
      dom.modal_wait.modal('hide');
      faded = false
    }
  }

//  function eq_obj (obj1, obj2) { return JSON.stringify(obj1) === JSON.stringify(obj2); }

  function state_renew (resp) {
    if (!_.isEqual(state.cameras, resp.result.cameras)) { update_cameras(resp.result.cameras); }
    if (!_.isEqual(state.cam_states, resp.result.cam_states)) { update_cam_states(resp.result.cam_states); }
    if (!_.isEqual(state.storages, resp.result.storages)) { update_storages(resp.result.storages); }
  }

  function update_cameras (new_cameras) {
    state.cameras = _.cloneDeep(new_cameras);
    dom.cam_pads._place.html(_.template(dom.cam_pads._tmpl, {cams: state.cameras}));
    state.cam_states = {}
  }

  function update_cam_states (new_cam_states) {
    console.debug(new_cam_states);
    state.cam_states = _.cloneDeep(new_cam_states);
    $.each(state.cam_states, function (c_uid, c_state) {
      var
        campad = find_cam_pad(c_uid),
        btn = campad.find('.btn-campad-act'),
        info_stat_link = campad.find('.cam-log-link'),

        current_command = c_state.current_command,
        control_state = c_state.control_state,
        state = c_state.state,
        state_info = c_state.state_info
      ;
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

    all_are_started = _.all(state.cam_states, function (st) {return st.control_state != 'ready'});
    all_are_stoped = _.all(state.cam_states, function (st) {return st.control_state == 'ready'});

    var mass_start_cam_uid = _.pluck(_.filter(state.cameras, 'mass_start'), 'uid');
    all_mass_started = _.all(mass_start_cam_uid, function (cam_uid) {
      return state.cam_states[cam_uid].control_state != 'ready'
    });

    some_started = _.some(state.cam_states, function (st) {return st.control_state != 'ready'});
    some_stoped = _.some(state.cam_states, function (st) {return st.control_state == 'ready'});

    dom.navbar.btn_settings.prop('disabled', !all_are_stoped);
    $('.btn-detach-ext').prop('disabled', !all_are_stoped);
    dom.navbar.btn_mass_run.prop('disabled', all_mass_started );
    dom.navbar.btn_mass_stop.prop('disabled', !some_started);
  }

  function update_storages (new_storages) {
    var
      showed_popover = $('.popover'),
      showed_popover_stor = showed_popover.find('.table-in-popover').attr('data-stor-mp')
    ;
    state.storages = _.cloneDeep(new_storages);
    find_dev_pad(showed_popover_stor).popover('destroy');
    dom.navbar.storage_pads._place.html(
      _.template(dom.navbar.storage_pads._tmpl,{
        storages_int: _.filter(state.storages, function (storage) {
          return !storage.ext && (storage.mounted || storage.attached)
        }),
        storages_ext: _.filter(state.storages, function (storage) {
          return storage.ext && (storage.mounted || storage.attached)
        })
      })
    );
    $('.dev-pad').popover({trigger: 'hover', container: '.toolbar', placement: 'bottom', animation: false});
    find_dev_pad(showed_popover_stor).popover('show');
    $('.btn-detach-ext').prop('disabled', !all_are_stoped);
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

  $.fn.detach_storage = function (mp) {
    rpc_call('storage_detach', {mp: mp})
  };

  function cam_act (act, cam_uid) {
    var cam_ids;
    if ((act == 'run') && !cam_uid) {
      cam_ids = _.pluck(_.filter(state.cameras, 'mass_start'), 'uid')
    } else {
      cam_ids = cam_uid ? [cam_uid] : _.pluck(state.cameras, 'uid')
    }

    rpc_call('cams_action', {
      action: act,
      ch_uids: cam_ids
    });
  }

  dom.body
    .on('click', '.dev-pad',
      function (e) {
        if ($(this).data('bs.popover').tip().hasClass('in')) {
          $(this).popover('toggle');
        }
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
    )
    .on('click', '.cam-log-link',
      function () {
        var
          me = this,
          my_cam_uid = $(me).closest('.campad').attr('data-cam-uid')
        ;
//        show_logs(my_cam_uid);
    }
    );

  dom.navbar.btn_mass_run.on({
    click: function () { cam_act('run') }
//    mouseenter: function () { $('.mass-start').addClass('mass-start-highlighted'); },
//    mouseout: function () { $('.mass-start').removeClass('mass-start-highlighted'); }
  });

  dom.navbar.btn_mass_stop.on({
    click: function () { cam_act('stop') }
  });

  function show_settings () {
    cams_tmp = _.cloneDeep(state.cameras);
    dom.settings._place.html(_.template(dom.settings._tmpl, {cams: cams_tmp /*, settings: data.shared_settings */}));
    dom.settings._form = dom.settings._place.find('.modal');
    dom.settings._form.modal({'backdrop': 'static', 'width': 900});
    settings_binds();
  }

  // SETTINGS FORM

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
      pwd: dom.settings.map.cams_frm.find('input[name="pwd"]'),
      mass_start: dom.settings.map.cams_frm.find('input[name="mass_start"]')
    }
  }

  function check_changes () {
    var eq = !_.isEqual(cams_tmp, state.cameras);
    dom.settings.map.btn_apply.toggleClass('hide', !eq);
    return eq
  }

  function check_valid () {
    var errors = {}, result = '', bad_letters = ' <, >, :, ", /, \\, |, ?, *, .';
    _(cams_tmp).forEach(function (cam) {
      errors[cam.uid] = {'alias': cam.alias, 'wrongs': []};
      if (_.isEmpty(cam.alias)) { errors[cam.uid].wrongs.push('\tназвание обязательно') }
      if (!/[^\\\/:*?"<>|\r\n\.]+$/im.test(cam.alias)) {
        errors[cam.uid].wrongs.push('\tне корректное имя\nнедопустимые символы: [' + bad_letters +']')
      }
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
    console.log(last_option);
    dom.settings.map.select.val(last_option.val()).change();
  }

  function add_cam (cam_conf) {
    var
      uid = (Math.floor(Math.random() * Math.pow(10,10)) + 1).toString(16),
      _conf = cam_conf || {alias: null, ip: null, uri: null, user: null, pwd: null, mass_start: null},
      new_cam = {
        uid   : 'uid_' + uid,
        alias : _conf.alias  || 'новая камера ' + uid,
        ip    : _conf.ip     || '',
        uri   : _conf.uri    || '',
        user  : _conf.user   || '',
        pwd   : _conf.pwd    || '',
        mass_start: _.isNull(_conf.mass_start) ? 1 : _conf.mass_start
      }
    ;
    cams_tmp[new_cam.uid] = new_cam;
    dom.settings.map.select.append($('<option value="' + new_cam.uid + '">' + new_cam.alias + '</option>'));
    select_last_cam();
    check_changes();
  }

  function settings_binds () {
    settings_frm_remap();
    var selected_cam;

    dom.settings.map.select.on({
      change: function (e) {
        selected_cam = cams_tmp[$(this).val()];
        if (selected_cam) {
          $.each(dom.settings.map.cams_frm.fields, function (name, el) {
            $(el)
              .val(selected_cam[name])
              .prop('disabled', false);
            if (name == 'mass_start') $(el).prop('checked', selected_cam[name]);
          });
        } else {
          $.each(dom.settings.map.cams_frm.fields, function (name, el) {
            $(el)
              .val('')
              .prop('disabled', true);
          });
        }
      }
    });

    function change_input_handler () {
      var
          me = $(this),
          my_name = me.attr('name')
        ;
      if (!selected_cam) return;
        if (my_name == 'alias') {
          dom.settings.map.select.find('option:selected').text(me.val());
        }
        selected_cam[my_name] = me.val();
        if (my_name == 'mass_start') selected_cam[my_name] = me.prop('checked');
        check_changes();
    }

    dom.settings.map.cams_frm.find('input').on({
      keyup: change_input_handler,
      change: change_input_handler
    });

    dom.settings.map.btn_apply.on({
      click: function () {
        if (check_changes() && check_valid()) {
          rpc_call('edit_cams', {changes: get_changes(state.cameras, cams_tmp, 'uid')});
          dom.settings._form.modal('hide');
        }
      }
    });

    dom.settings.map.btn_del.on({
      click: function () {
        if (!selected_cam) return;
        delete cams_tmp[selected_cam.uid];
//        _.remove(cams_tmp, function (cam) {return cam.uid == selected_cam.uid});
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
      } else {
        alert(
          'синтаксические ошибки в списке: \n' +
            '\tjson - объекты в формате:\n' +
            '\t{"ключ": "значение"} через запятую'
        );
      }

    }
  });

  //  SETTINGS end

  function show_logs (cam_uid) {
    dom.cam_logs._place.html(
        _.template(dom.cam_logs._tmpl, {cam: state.cameras[cam_uid]})
      );
    dom.cam_logs._form = dom.cam_logs._place.find('.modal');
    dom.cam_logs._form.modal();
  }

  dom.navbar.btn_settings.on({
    'click': show_settings
  });

  start_get_state_loop();


  // fade if server is down




});
