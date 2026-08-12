import { config } from 'md-editor-v3'
import { resolveAttachmentUrls } from '~/utils/attachment'

export default defineNuxtPlugin(() => {
  config({
    codeMirrorExtensions(extensions) {
      return extensions.filter(ext => ext.type !== 'linkShortener')
    },
    markdownItConfig(md) {
      md.core.ruler.before('normalize', 'resolve_attachments', (state) => {
        state.src = resolveAttachmentUrls(state.src)
      })
    },
    editorConfig: {
      // md-editor-v3는 zh-CN/en-US만 내장하고 있어서, 한국어(ko-KR)는
      // 직접 등록해줘야 툴바 툴팁/모달 텍스트가 한글로 나온다.
      languageUserDefined: {
        'ko-KR': {
          toolbarTips: {
            bold: '굵게',
            underline: '밑줄',
            italic: '기울임',
            strikeThrough: '취소선',
            title: '제목',
            sub: '아래첨자',
            sup: '위첨자',
            quote: '인용',
            unorderedList: '글머리 기호 목록',
            orderedList: '번호 매기기 목록',
            task: '할 일 목록',
            codeRow: '인라인 코드',
            code: '코드 블록',
            link: '링크',
            image: '이미지',
            table: '표',
            mermaid: 'mermaid',
            katex: '수식',
            revoke: '실행 취소',
            next: '다시 실행',
            save: '저장',
            prettier: '정리',
            pageFullscreen: '페이지 전체화면',
            fullscreen: '전체화면',
            preview: '미리보기',
            previewOnly: '미리보기만',
            htmlPreview: 'HTML 미리보기',
            catalog: '목차',
            github: '소스 코드',
          },
          titleItem: {
            h1: '제목 1',
            h2: '제목 2',
            h3: '제목 3',
            h4: '제목 4',
            h5: '제목 5',
            h6: '제목 6',
          },
          imgTitleItem: {
            link: '이미지 링크 추가',
            upload: '이미지 업로드',
            clip2upload: '자르기 후 업로드',
          },
          linkModalTips: {
            linkTitle: '링크 추가',
            imageTitle: '이미지 추가',
            descLabel: '설명:',
            descLabelPlaceHolder: '설명을 입력하세요...',
            urlLabel: '링크:',
            urlLabelPlaceHolder: '링크를 입력하세요...',
            buttonOK: '확인',
          },
          clipModalTips: {
            title: '이미지 자르기',
            buttonUpload: '업로드',
          },
          copyCode: {
            text: '복사',
            successTips: '복사됐어요!',
            failTips: '복사에 실패했어요!',
          },
          mermaid: {
            flow: '순서도',
            sequence: '시퀀스 다이어그램',
            gantt: '간트 차트',
            class: '클래스 다이어그램',
            state: '상태 다이어그램',
            pie: '원형 차트',
            relationship: '관계도',
            journey: '여정 지도',
          },
          katex: {
            inline: '인라인',
            block: '블록',
          },
          footer: {
            markdownTotal: '글자 수',
            scrollAuto: '자동 스크롤',
          },
        },
      },
    },
  })
})
