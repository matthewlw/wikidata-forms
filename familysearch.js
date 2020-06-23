const endpoint = 'https://tools.wmflabs.org/openrefine-wikidata/en/suggest/entity'

function processSuggestions (suggestions) {
  return suggestions.result.map(x => {
    return x.name + ' - ' + x.description + ' - ' + x.id
  })
}

function updateAutocomplete (box) {
  if (!box.input.value) {
    return
  }
  let url = endpoint + '?prefix=' + encodeURIComponent(box.input.value)
  if (box.input.dataset.p31) {
    url = url + '&type=' + box.input.dataset.p31
  }
  window.fetch(url).then(r => r.json()).then(obj => {
    box.list = processSuggestions(obj)
    box.evaluate()
  }).catch(e => console.log(e))
}

function setupAutocomplete (box) {
  const boxAwesomplete = new Awesomplete(box)
  const debounced = _.debounce(_.partial(updateAutocomplete, boxAwesomplete), 500)
  box.addEventListener('input', debounced)
}

function readQID (boxID) {
  const box = document.getElementById(boxID)
  if (box.value.includes(' - ')) {
    const parts = box.value.split(' - ')
    return parts[parts.length - 1]
  }
}

function formatStringQS (s) {
  return '"' + s.toString().replace('"', '\\"') + '"'
}

function formatDateQS(s) {
  if (s.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return '+' + s + 'T00:00:00Z/11'
  } else if (s.match(/^\d{4}-\d{2}$/)) {
    return '+' + s + '-00T00:00:00Z/10'
  } else if (s.match(/^\d{4}$/)) {
    return '+' + s + '-00-00T00:00:00Z/9'
  } else {
    alert('"' + s + '"' + ' is not a valid date')
  }
}

function makeReference () {
  const collection = document.getElementById('familysearch-collection').value
  const ark = document.getElementById('familysearch-url').value.split('familysearch.org/')[1]
  return [
    'S8091', formatStringQS(ark),
    'S6333', 'en:' + formatStringQS(collection)
  ].join('\t')
}

function processNames (subject) {
  const givenNames = _.compact([1, 2, 3, 4].map(x => readQID('given-name' + x)))
  const familyName = readQID('family-name')
  let statements = givenNames.map((qid, index) => {
    return subject + '\tP735\t' + qid + '\tP1545\t' + formatStringQS(index + 1)
  })
  if (familyName) {
    statements.push(subject + '\tP734\t' + familyName)
  }
  return statements
}

function processFamily (subject) {
  gender_name = new FormData(document.querySelector('form')).get('sexgender')
  parent_prop = gender_name === 'male' ? 'P22' : 'P25'
  gender_qid = gender_name === 'male' ? 'Q6581097' : 'Q6581072'
  return [].concat(
    // [subject + '\tP21\t' + gender_qid],
    processRelation(subject, 'mother', 'P25', 'P40'),
    processRelation(subject, 'father', 'P22', 'P40'),
    processRelation(subject, 'child1', 'P40', parent_prop),
    processRelation(subject, 'child2', 'P40', parent_prop),
    processRelation(subject, 'child3', 'P40', parent_prop),
    processRelation(subject, 'child4', 'P40', parent_prop),
    processRelation(subject, 'child5', 'P40', parent_prop),
    processRelation(subject, 'child6', 'P40', parent_prop),
    processRelation(subject, 'spouse', 'P26', 'P26')
  )
}

function processRelation (subject, id, property, inverseProperty) {
  const object = readQID(id)
  if (!object) {
    return []
  }
  return [
    [subject, property, object].join('\t'),
    [object, inverseProperty, subject].join('\t')
  ]
}

function processVitalDates (subject) {
  return [].concat(
    processVitalDate(subject, 'birth', 'P569', 'P19'),
    processVitalDate(subject, 'baptism', 'P1636', ''),
    processVitalDate(subject, 'death', 'P570', 'P20'),
    processVitalDate(subject, 'burial', 'P4602', 'P119')
  )
}

function processVitalDate (subject, eventType, dateProperty, placeProperty) {
  const dateValue = document.getElementById('date-of-' + eventType).value
  const isCirca = document.getElementsByName('date-of-' + eventType + '-circa')[0].checked
  const ageAtEventValue = document.getElementById('age-at-' + eventType).value
  const latestDateValue = document.getElementById('latest-date-' + eventType).value
  const placeOfEvent = readQID('place-of-' + eventType)
  let statements = []
  let dateFragments = [subject, dateProperty]
  dateFragments.push(dateValue ? formatDateQS(dateValue) : "somevalue")
  if (isCirca) {
    dateFragments.push('P1480')
    dateFragments.push('Q5727902')
  }
  if (ageAtEventValue) {
    dateFragments.push('P3629')
    dateFragments.push(ageAtEventValue.toString() + 'U24564698')
  }
  if (latestDateValue) {
    dateFragments.push('P1326')
    dateFragments.push(formatDateQS(latestDateValue))
  }
  if (!(dateFragments.length == 3 && dateFragments[2] == 'somevalue')) {
    statements.push(dateFragments.join('\t'))
  }
  if (placeOfEvent && placeProperty) {
    statements.push([subject, placeOfEvent, placeProperty].join('\t'))
  }
  return statements
}

function processOtherPersonal (subject) {
  const residence = readQID('residence')
  const occupation = readQID('occupation')
  let statements = []
  if (residence) {
    statements.push([subject, 'P551', residence].join('\t'))
  }
  if (occupation) {
    statements.push([subject, 'P106', occupation].join('\t'))
  }
  return statements
}

window.addEventListener('DOMContentLoaded', () => {
  Array.from(document.getElementsByClassName('awesomplete')).forEach(setupAutocomplete)
  document.querySelector('form').addEventListener('submit', evt => {
    evt.preventDefault()
    const outputBox = document.querySelector('textarea')
    const subject = readQID('record-subject')
    const reference = makeReference()
    let allStatements = [].concat(
      processNames(subject),
      processFamily(subject),
      processVitalDates(subject),
      processOtherPersonal(subject)
    )
    outputBox.value = allStatements.map(x => x + '\t' + reference).join('\n')
  })
})
