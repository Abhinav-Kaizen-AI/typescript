const applyRelatedEntityFormConfigsToGroup = (config, item, parentItem?, createForm?) => {
    // get form with id
    const { groups: screenConfigGroups } = config;
  
    const listScreenConfig = JSON.parse(window.localStorage.getItem("schad-screenConfig") || "[]").find(
      (listConfig) => listConfig.name === config.name,
    );
    if (config.type === "RELATED_LIST" && !listScreenConfig) {
      const listEntityConfig = getEntityConfig(config.entity);
      if (!listEntityConfig) {
        return screenConfigGroups;
      }
  
      const listGroupFields = getFKAliasesConfig(listEntityConfig, ["title", "subtitle", "subsubtitle"]);
      const updatedGroups = screenConfigGroups.map((group, i) => ({
        ...group,
        fields: [...(i === 0 ? listGroupFields : [])],
      }));
      return updatedGroups;
    }
  
    let form = getFormConfigByFormId(item?.relatedItem, createForm);
    if (form && config?.type !== "RELATED_LIST") {
      // If a form exists for the related item and the type is not RELATED_LIST,
      // apply entity form configurations for the related item.
      return applyEntityFormConfigsToGroup(config, item?.relatedItem, form.formId);
    } else {
      // If no parent form is available, return the screenConfig groups for type list or details.
      form = getFormConfigByFormId(item?.parentEntity || parentItem, createForm);
      if (!form) {
        return screenConfigGroups;
      }
    }
    // If no form exists for the related item, but for a form for the parent entity.
    // type could be either list of details
  
    // get related form fields
    const relatedFormConfig: RelatedEntityConfigType | undefined = form.settings.relatedEntities.find(
      (relatedEntity) => config.entity === relatedEntity.name,
    );
  
    const fieldsWithMobileFormEnabled =
      relatedFormConfig !== undefined
        ? relatedFormConfig.columns.filter((field) => {
            return field.displayOnMobileForm || (field.required && !systemEntityFields.includes(field.name));
          })
        : [];
    const relatedEntityFieldsMap = fieldsWithMobileFormEnabled.reduce((acc, field) => {
      acc[field.name] = field;
      return acc;
    }, {});
    // create groups from existing screen config and filter fields which has behaviour or field is present in related fields
    let screenConfigRelevantFieldGroups = screenConfigGroups.map((group) => ({
      ...group,
      fields: [...group.fields.filter((field) => field.behaviour || relatedEntityFieldsMap[field.name])],
    }));
    // filter fields which are not present in groups from related fields and add it to groups
    const screenConfigRelevantFields =
      screenConfigRelevantFieldGroups.reduce((groupFields, group) => {
        group.fields.length && groupFields.push(...group.fields);
        return groupFields;
      }, []) || [];
  
    const firstGroup = screenConfigRelevantFieldGroups[0] || { fields: [] };
  
    const updatedFirstGroupFields = [
      ...firstGroup.fields.filter((field) => !relatedEntityFieldsMap[field.name]),
      ...fieldsWithMobileFormEnabled.map((field) => {
        const existingField = firstGroup.fields.find((existing) => existing.name === field.name);
        return existingField || field;
      }),
    ];
  
    screenConfigRelevantFieldGroups[0] = {
      ...firstGroup,
      fields: updatedFirstGroupFields,
    };
  
    const screenConfigRelevantFieldsMap = screenConfigRelevantFields.reduce((acc, field) => {
      acc[field.name] = field;
      return acc;
    }, {});
  
    // const additionalRelatedEntityFields = fieldsWithMobileFormEnabled?.filter(
    //   (field) => !screenConfigRelevantFieldsMap[field.name],
    // );
    // const relatedEntityAdditionalFieldsMap = additionalRelatedEntityFields.reduce((acc, field) => {
    //   acc[field.name] = field;
    //   return acc;
    // }, {});
    // get required entity fields and filter out which are required but not system and should not be present in groups
    const entityConfig = getEntityConfig(config.entity);
    const entityConfigColumns = entityConfig?.columns;
    const entityLevelFields = entityConfigColumns ? Object.values(entityConfigColumns) : [];
  
    const requiredEntityFields = entityLevelFields.filter(
      (field) => field.required && !screenConfigRelevantFieldsMap[field.name] && !systemEntityFields.includes(field.name),
    );
    if (screenConfigRelevantFieldGroups.length) {
      screenConfigRelevantFieldGroups = screenConfigRelevantFieldGroups.map((group, i) => {
        const isLastGroup = i === screenConfigGroups.length - 1;
        if (isLastGroup) {
          if (config.type !== "RELATED_LIST") {
            group.fields.push(...requiredEntityFields);
          }
        }
        return group;
      });
    } else {
      screenConfigRelevantFieldGroups.push({
        fields: config.type === "RELATED_LIST" ? [] : [...requiredEntityFields],
      });
    }
  
    // entity config for field
    const updatedGroupsWithEntityDataMapForFields = screenConfigRelevantFieldGroups.map((group) => {
      return {
        ...group,
        fields: [
          ...[...group.fields].map((columnOptions) => {
            if (!entityConfigColumns) return columnOptions;
            const { name } = columnOptions;
            return formFieldConfig(entityConfigColumns, name, columnOptions, screenConfigRelevantFieldsMap);
          }),
        ],
      };
    });
    return updatedGroupsWithEntityDataMapForFields;
  };

  const applyEntityFormConfigsToGroup = (config, item, createForm?) => {
    const { groups: screenConfigGroups } = config;
    const form = getFormConfigByFormId(item, createForm);
    if (!form) {
      return screenConfigGroups;
    }
    const entityConfig = getEntityConfig(config.entity);
    const entityConfigColumns = entityConfig?.columns;
  
    const groupsToDisplay = form.settings.groups.map((group) => {
      const fields = group.columns.reduce((acc, field) => {
        const translatedHintText = form.settings.labels?.[getLanguageCode()]?.[`hint.${field.name}`] || null;
        const fieldConfig = entityConfigColumns?.[field.name];
        if (
          field.displayOnMobileForm ||
          ((field.required || fieldConfig?.required) && !systemEntityFields.includes(field.name))
        ) {
          acc.push({ ...field, hint: translatedHintText ?? field.hint });
        }
        return acc;
      }, []);
      return {
        ...group,
        fields: fields,
      };
    });
  
    const screenConfigGroupFields =
      screenConfigGroups.reduce((groupFields, group) => {
        groupFields.push(...group.fields);
        return groupFields;
      }, []) || [];
  
    const screenConfigFieldsMap = screenConfigGroupFields.reduce((acc, field) => {
      acc[field.name] = field;
      return acc;
    }, {});
    const screenConfigGroupsBehaviours =
      screenConfigGroups.reduce((groupBehaviours, group) => {
        groupBehaviours.push(...group.behaviours);
        return groupBehaviours;
      }, []) || [];
  
    const lastGroup = groupsToDisplay[groupsToDisplay.length - 1];
  
    const allFieldsInForm = groupsToDisplay.reduce((acc, group) => {
      acc.push(...group.fields);
      return acc;
    }, []);
    const allFieldsInFormNames = allFieldsInForm.reduce((acc, field) => {
      acc.push(field.name);
      return acc;
    }, []);
  
    const fieldsWithBehaviorsNotInForm = screenConfigGroupFields
      .filter((field) => !!field.behaviour)
      .filter((field) => allFieldsInFormNames.findIndex((item) => item === field.name) === -1);
  
    lastGroup.fields = [...lastGroup.fields, ...fieldsWithBehaviorsNotInForm];
    lastGroup.behaviours = screenConfigGroupsBehaviours;
  
    const updatedGroupsWithEntityDataMapForFields = groupsToDisplay.map((group) => {
      return {
        ...group,
        label: group.labels[getLanguageCode()] ?? group.labels["en-US"],
        fields: [
          ...[...group.fields].map((columnOptions) => {
            if (!entityConfigColumns) return columnOptions;
            const { name } = columnOptions;
            return formFieldConfig(entityConfigColumns, name, columnOptions, screenConfigFieldsMap);
          }),
        ],
      };
    });
    return updatedGroupsWithEntityDataMapForFields;
  };