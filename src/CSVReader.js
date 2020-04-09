import React from 'react'
import PropTypes from 'prop-types'
import PapaParse from 'papaparse'
import getSize from './util'
import RemoveIcon from './RemoveIcon'

const GREY = '#ccc'
const GREY_LIGHT = 'rgba(255, 255, 255, 0.4)'
const RED = '#A01919'
const RED_LIGHT = '#DD2222'

const styles = {
  dropArea: {
    alignItems: 'center',
    borderColor: GREY,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderRadius: 20,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    justifyContent: 'center',
    padding: 20
  },
  inputFile: {
    display: 'none'
  },
  highlight: {
    borderColor: 'purple'
  },
  unhighlight: {
    borderColor: GREY
  },
  dropFile: {
    background: 'linear-gradient(to bottom, #eee, #ddd)',
    borderRadius: 20,
    display: 'block',
    height: 120,
    width: 100,
    paddingLeft: 10,
    paddingRight: 10,
    position: 'relative',
    zIndex: 10
  },
  column: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  },
  progressBar: {
    borderRadius: 3,
    boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, .2)',
    bottom: 14,
    position: 'absolute',
    width: '80%'
  },
  progressBarFill: {
    backgroundColor: '#659cef',
    borderRadius: 3,
    height: 10,
    transition: 'width 500ms ease-in-out'
  },
  fileSizeInfo: {
    backgroundColor: GREY_LIGHT,
    borderRadius: 3,
    lineHeight: 1,
    marginBottom: '0.5em',
    padding: '0 0.4em'
  },
  fileNameInfo: {
    backgroundColor: GREY_LIGHT,
    borderRadius: 3,
    fontSize: 14,
    lineHeight: 1,
    padding: '0 0.4em'
  },
  defaultCursor: {
    cursor: 'default'
  },
  pointerCursor: {
    cursor: 'pointer'
  }
}

export default class CSVReader extends React.Component {
  inputFileRef = React.createRef()
  dropAreaRef = React.createRef()
  fileSizeInfoRef = React.createRef()
  fileNameInfoRef = React.createRef()
  progressBarFillRef = React.createRef()

  static propTypes = {
    children: PropTypes.any.isRequired,
    onDrop: PropTypes.func,
    onFileLoad: PropTypes.func,
    onError: PropTypes.func,
    config: PropTypes.object,
    style: PropTypes.object,
    noClick: PropTypes.bool,
    noDrag: PropTypes.bool,
    progressBarColor: PropTypes.string,
    addRemoveButton: PropTypes.bool,
    onRemoveFile: PropTypes.func
  }

  state = {
    dropAreaStyle: styles.dropArea,
    progressBar: 0,
    displayProgressBarStatus: 'none',
    file: null,
    timeout: null,
    files: null,
    removeIconColor: RED,
    isCanceled: false
  }

  componentDidMount = () => {
    const currentDropAreaRef = this.dropAreaRef.current

    const fourDragsEvent = ['dragenter', 'dragover', 'dragleave', 'drop']
    fourDragsEvent.forEach(item => {
      currentDropAreaRef.addEventListener(item, this.preventDefaults, false)
    })

    if (!this.props.noDrag) {
      const highlightDragsEvent = ['dragenter', 'dragover']
      highlightDragsEvent.forEach(item => {
        currentDropAreaRef.addEventListener(item, this.highlight, false)
      })
      currentDropAreaRef.addEventListener('dragleave', this.unhighlight, false)
      currentDropAreaRef.addEventListener('drop', this.unhighlight, false)
      currentDropAreaRef.addEventListener('drop', this.visibleProgressBar, false)
      currentDropAreaRef.addEventListener('drop', this.handleDrop, false)
    }
  }

  preventDefaults = e => {
    e.preventDefault()
    e.stopPropagation()
  }

  highlight = () => {
    this.setState({ dropAreaStyle: Object.assign({}, styles.dropArea, styles.highlight) })
    this.initializeProgress()
  }

  initializeProgress = () => {
    this.setState({ progressBar: 0 })
  }

  unhighlight = () => {
    this.setState({ dropAreaStyle: Object.assign({}, styles.dropArea, styles.unhighlight) })
  }

  visibleProgressBar = () => {
    this.setState({ displayProgressBarStatus: 'block' })
  }

  handleDrop = e => {
    let files = {}
    let isCanceled = false
    if (e.files === undefined) {
      const dt = e.dataTransfer
      files = dt.files
    } else {
      files = e.files
    }
    if (files.length === 0) {
      files = this.state.files
      isCanceled = true
    }
    this.setState({ files, isCanceled }, () => { this.handleFiles() })
  }

  handleFiles = () => {
    this.setState({ progressBar: 0 })
    let files = null
    files = [...this.state.files]
    files.forEach(this.uploadFile)
  }

  uploadFile = (file, index) => {
    this.displayFileInfo(file)
    this.setState({ file })

    const {
      onDrop,
      onFileLoad,
      onError,
      config = {}
    } = this.props

    const reader = new window.FileReader()

    let options = {}

    if (config.error) {
      delete config.error
    }

    if (config.step) {
      delete config.step
    }

    if (config.complete) {
      delete config.complete
    }

    const size = file.size
    const data = []
    let percent = 0

    if (onDrop || onFileLoad) {
      const self = this
      options = Object.assign({
        complete: () => {
          if (!onDrop) {
            onFileLoad(data)
          } else {
            onDrop(data)
          }
        },
        step: (row, parser) => {
          data.push(row)
          const progress = row.meta.cursor
          const newPercent = Math.round(progress / size * 100)
          if (newPercent === percent) return
          percent = newPercent
          self.updateProgress(percent)
        }
      }, options)
    }

    if (onError) {
      options = Object.assign({ error: onError }, options)
    }

    if (config) {
      options = Object.assign(config, options)
    }

    reader.onload = e => {
      PapaParse.parse(e.target.result, options)
    }

    reader.onloadend = e => {
      clearTimeout(this.state.timeout)
      this.setState({ timeout: setTimeout(() => { this.disableProgressBar() }, 2000) })
    }

    reader.readAsText(file, config.encoding || 'utf-8')
  }

  displayFileInfo = file => {
    if (!this.childrenIsFunction()) {
      this.fileSizeInfoRef.current.innerHTML = getSize(file.size)
      this.fileNameInfoRef.current.innerHTML = file.name
    }
  }

  updateProgress = percent => {
    this.setState({ progressBar: percent })
  }

  disableProgressBar = () => {
    this.setState({ displayProgressBarStatus: 'none' })
  }

  childrenIsFunction = () => {
    return typeof this.props.children === 'function'
  }

  handleInputFileChange = e => {
    const { target } = e
    this.setState({ displayProgressBarStatus: 'block' }, () => { this.handleDrop(target) })
  }

  open = e => {
    if (e) {
      e.stopPropagation()
      this.inputFileRef.current.click()
    }
  }

  renderChildren = () => {
    return this.childrenIsFunction()
      ? this.props.children({ file: this.state.file })
      : this.props.children
  }

  removeFile = e => {
    if (e) {
      e.stopPropagation()
      this.setState({ files: null, file: null })

      const { onRemoveFile } = this.props
      if (onRemoveFile) {
        onRemoveFile(null)
      }

      this.inputFileRef.current.value = null
    }
  }

  changeRemoveIconColor = (color) => {
    if (color) {
      this.setState({ removeIconColor: color })
    }
  }

  render() {
    const {
      style,
      noClick,
      children,
      progressBarColor,
      addRemoveButton
    } = this.props

    return (
      <>
        <input
          type='file'
          accept='text/csv'
          ref={this.inputFileRef}
          style={styles.inputFile}
          onChange={e => this.handleInputFileChange(e)}
        />
        {
          !this.childrenIsFunction() ? (
            <div
              ref={this.dropAreaRef}
              style={Object.assign({}, style, this.state.dropAreaStyle, noClick ? styles.defaultCursor : styles.pointerCursor)}
              onClick={(e) => {
                if (!noClick) {
                  this.open(e)
                }
              }}
            >
              {
                this.state.files && this.state.files.length > 0 ? (
                  <div style={Object.assign({}, styles.dropFile, styles.column)}>
                    {
                      addRemoveButton && (
                        <div
                          style={{
                            height: 23,
                            position: 'absolute',
                            right: 6,
                            top: 6,
                            width: 23
                          }}
                          onClick={(e) => this.removeFile(e)}
                          onMouseOver={() => this.changeRemoveIconColor(RED_LIGHT)}
                          onMouseOut={() => this.changeRemoveIconColor(RED)}
                        >
                          <RemoveIcon color={this.state.removeIconColor} />
                        </div>
                      )
                    }
                    <div style={styles.column}>
                      <span style={styles.fileSizeInfo} ref={this.fileSizeInfoRef} />
                      <span style={styles.fileNameInfo} ref={this.fileNameInfoRef} />
                    </div>
                    {
                      this.state.files && this.state.files.length > 0 && !this.state.isCanceled && (
                        <div style={styles.progressBar}>
                          <span
                            style={
                              Object.assign(
                                {},
                                styles.progressBarFill,
                                {
                                  width: `${this.state.progressBar}%`,
                                  display: this.state.displayProgressBarStatus
                                })
                            }
                            ref={this.progressBarFillRef}
                          />
                        </div>
                      )
                    }
                  </div>
                ) : (
                  children
                )
              }
            </div>
          ) : (
            <div ref={this.dropAreaRef}>
              {this.renderChildren()}
              {
                this.state.files && this.state.files.length > 0 && !this.state.isCanceled && (
                  <div style={Object.assign({}, styles.progressBar, { position: 'inherit', width: '100%' })}>
                    <span
                      style={
                        Object.assign(
                          {},
                          styles.progressBarFill,
                          { backgroundColor: progressBarColor || '#659cef' },
                          {
                            width: `${this.state.progressBar}%`,
                            display: this.state.displayProgressBarStatus
                          })
                      }
                      ref={this.progressBarFillRef}
                    />
                  </div>
                )
              }
            </div>
          )
        }
      </>
    )
  }
}
