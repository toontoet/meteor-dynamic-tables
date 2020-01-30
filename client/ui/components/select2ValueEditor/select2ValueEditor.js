import "./select2ValueEditor.html";
import { getValue, inlineSave, nextField } from "../../../inlineSave.js";

function getAjaxConfig(origOptions, optionsResult) {
  const self = this;
  if (!_.isFunction(origOptions) || optionsResult) {
    return undefined;
  }
  let hadResults = false;
  return {
    transport(params, success, failure) {
      const val = self.data.value || getValue(self.data.doc, self.data.column.data) || [];
      origOptions(self.data.doc, self.data.column, val, params.data.q, (results) => {
        if (results.length && !hadResults) {
          const select = self.$(document.getElementsByClassName(`${self.selectId}`));
          select.empty();
          results.forEach((result) => {
            select.append($("<option selected=\"selected\" aria-selected=\"true\">").text(result.text).val(result.id));
          });
          select.val(val).trigger("change");
          hadResults = true;
        }
        success({ results });
      });
    }
  };
}

function handler(e) {
  if (nextField.inProgress) {
    return;
  }

  let $select = $(e.currentTarget).closest("td").find(".dynamicTableSelect2ValueEditor");
  if (!$select.length) {
    const possibles = _.toArray($(".select2-container"));
    $select = $(
      possibles
      .find((elem) => {
        const element = $(elem).data("element");
        if (element) {
          const select2Data = element.data("select2");
          if (select2Data) {
            return select2Data.$dropdown.find(e.currentTarget).length;
          }
        }
        return false;
      })
    )
    .closest("td")
    .find(".dynamicTableSelect2ValueEditor");
  }
  if (!$select.length) {
    return;
  }
  const tmplInstance = Blaze.getView($select[0]).templateInstance();
  if (e.keyCode === 9) {
    inlineSave(tmplInstance, $select.val());
    nextField(tmplInstance);
  }
}

// NOTE: not sure why we need different handlers for multi vs single? Could be JP-common code?
jQuery(document).ready(($) => {
  $(document).on('keydown', '.select2-search--dropdown input.select2-search__field', handler);
  $(document).on('keyup', '.select2-selection--multiple input.select2-search__field', handler);
});

Template.dynamicTableSelect2ValueEditor.onCreated(function onCreated() {
  this.selectId = this.data.id || "selectId";
  this.placeholder = this.data.placeholder || "";
});

Template.dynamicTableSelect2ValueEditor.onRendered(function onRendered() {

  let options = this.data.options;
  const val = this.data.value || getValue(this.data.doc, this.data.column.data) || [];

  let templInstance = Template.instance();

  const origOptions = options;
  let promise = Promise.resolve(options);
  if (_.isFunction(options)) {
    promise = new Promise((resolve) => {
      options = options(this.data.doc, this.data.column, val, undefined, (_options) => {
        resolve(_options);
      });
      if (options) {
        resolve(options);
      }
    });
  }
  promise.then((asyncOptions) => {
    const select = this.$("select");
    function select2CopyClasses(data, container) {
      return $(`<option class="${data.class}" >${data.text}</option>`);
    }
    select.select2({
      minimumInputLength: this.data.minimumInputLength !== undefined ? this.data.minimumInputLength : (_.isArray(options) ? 0 : 1),
      language: {
        inputTooShort: () => this.data.emptyInputMessage || "Start Typing..."
      },
      templateResult: select2CopyClasses,
      multiple: !!this.data.multiple,
      triggerEditOnChange: !!this.data.triggerEditOnChange || true,
      allowClear: true,
      tags: this.data.tags || !asyncOptions,
      createTag: _.isFunction(this.data.createTag) ? this.data.createTag : ((params) => {
        const term = $.trim(params.term);

        if (term === "" || this.data.createTag === false) {
          return null;
        }

        return {
          id: term,
          text: term
        };
      }),
      ajax: getAjaxConfig.call(this, origOptions, options),
      data: [{
        id: [],
        text: "",
        search: "",
        hidden: false
      }].concat(asyncOptions || []),
      placeholder: {
        id: [],
        text: this.data.placeholder || "Add Tags"
      }
    });
      select.val(_.uniq(val));
      select.trigger("change", { initial: true });

      if (this.data.maintainSelectedOrder) {
          _.uniq(val).forEach((value, index) => {
          let elem = templInstance.firstNode.children;
          let id = value.replace(" ", "");
          let $elem = $(elem);
          let chosenOption = $elem.find('[value='+id+']');
          $(chosenOption).prop('selected', true);
          chosenOption.detach();
          $(elem).append(chosenOption);
          $(elem).trigger("change");
          templInstance.data.editCallback($elem.find(":selected"));
        });
          select.trigger("change");
      }

    if (this.data.openSelect2Immediately !== false) {
      select.select2("open");
    }
  });
  if (this.data.saveOnBlur !== false) {
    if (this.handler) {
      document.removeEventListener("mousedown", this.handler, false);
    }
    this.handler = (e) => {
      try {
        const container = this.$("select").data("select2").$container;
        if (!container.has($(e.target)).length) {
          inlineSave(this, this.$("select").val(), this.$("select").data("select2").data());
        }
      }
      catch (e1) {
        document.removeEventListener("mousedown", this.handler, false);
      }
    };
    document.addEventListener("mousedown", this.handler, false);
  }
});

Template.dynamicTableSelect2ValueEditor.onDestroyed(function onDestroyed() {
  // this.$("select").data("select2") Specifically for the fix where client throw error =>
  // "The select2('destroy') method was called on an element that is not using Select2"
  if (this.$("select").data("select2")) {
    this.$("select").select2("destroy");
  }
  if (this.data.saveOnBlur !== false) {
    document.removeEventListener("mousedown", this.handler, false);
  }
});

Template.dynamicTableSelect2ValueEditor.helpers({
  inputClass() {
    return Template.instance().selectId;
  },
  customClass() {
    return Template.currentData().customClass;
  }
});

Template.dynamicTableSelect2ValueEditor.events({
  "select2:unselecting"(e, templInstance) {
    if (templInstance.data.maintainSelectedOrder) {
      let elem = e.target;
      let $elem = $(elem);
      $.each($elem.find(":selected"), function () {
        if ($(this).val() === e.params.args.data.id) {
          // NOTE: This prevents duplicate pills/tags appearing
          $(this).remove();
        }
      });
      $(e.target).trigger("change");
    }
  },
  "select2:select"(e, templInstance) {
    if (templInstance.data.maintainSelectedOrder) {
      let elem = e.target;
      let id = e.params.data.id;
      let $elem = $(elem);
      let chosenOption = $elem.find('[value='+id.replace(".","").replace(" ", "")+']');
      chosenOption.detach();
      $(e.target).append(chosenOption);
      let nameCounter = {};
      $.each($elem.find(":selected"), function () {
        nameCounter[$(this).val()] = (nameCounter[$(this).val()] || 0) + 1;
        if (nameCounter[$(this).val()] > 1) {
          //$(this).prop('selected', false); // NOTE: This prevents duplicate pills/tags appearing
          $(this).remove();
        }
      });
      $(e.target).trigger("change");
    }
  },
  "select2:close select"(e, templInstance) {
    const target = e.currentTarget;
    if (templInstance.waiting) {
      clearTimeout(templInstance.waiting);
    }
    if (templInstance.data.saveOnBlur !== false) {
      const data = templInstance.$("select").data("select2").data();
      templInstance.waiting = setTimeout(() => {
        if (!templInstance.data.multiple) {
          inlineSave(templInstance, $(target).val(), data);
        }
      }, 100);
    }
  },
  "change"(e, templInstance) {
    const target = e.currentTarget;
    if (templInstance.data.maintainSelectedOrder) {
      let elem = e.target;
      let $elem = $(elem);
      templInstance.data.editCallback($elem.find(":selected"));
    }
    if (typeof templInstance.data.triggerEditOnChange !== "undefined"
      && !templInstance.data.triggerEditOnChange
      && typeof templInstance.data.trackOptions !== "undefined"
      && templInstance.data.trackOptions
    ) {
      templInstance.data.docId = templInstance.data.doc.id;
      inlineSave(templInstance, $(target).val(), templInstance.$("select").data("select2").data());
    }
  }
});
